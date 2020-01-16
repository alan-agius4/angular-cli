/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BaseException, logging } from '@angular-devkit/core';
import { SpawnOptions, spawn } from 'child_process';
import { Observable, combineLatest, forkJoin, of, throwError, zip } from 'rxjs';
import { concatMap, filter, map, repeat, retryWhen, skip, skipUntil, take, tap, throwIfEmpty, timeout, skipWhile, startWith } from 'rxjs/operators';
import { Command } from './command';
import { BenchmarkReporter, Capture, MetricGroup, CaptureWatch } from './interfaces';
import { LocalMonitoredProcess } from './monitored-process';
import { aggregateMetricGroups } from './utils';

export interface RunBenchmarkWatchOptions {
  command: Command;
  captures: CaptureWatch[];
  reporters: BenchmarkReporter[];
  iterations?: number;
  retries?: number;
  expectedExitCode?: number;
  logger?: logging.Logger;

  triggerMatcher: RegExp;
  triggerTimeout?: number;
  triggerCmd: Command;
}

export class MaximumRetriesExceeded extends BaseException {
  constructor(retries: number) {
    super(`Maximum number of retries (${retries}) for command was exceeded.`);
  }
}

export function runBenchmarkWatch({
  command, captures, reporters = [], iterations = 5, retries = 5, logger = new logging.NullLogger(),
  triggerMatcher, triggerTimeout = 5000, triggerCmd,
}: RunBenchmarkWatchOptions): Observable<MetricGroup[]> {

  let successfulRuns = 0;
  let failedRuns = 0;
  const debugPrefix = () => `Run #${successfulRuns + 1}:`;
  let aggregatedMetricGroups: MetricGroup[] = [];

  // Run the process and captures, wait for both to finish, and average out the metrics.
  const monitoredProcess = new LocalMonitoredProcess(command);
  const processFailed = new BaseException('Wrong exit code.');

  const run = monitoredProcess.run().pipe(startWith(undefined));

  return combineLatest([run, monitoredProcess.stdout$])
    .pipe(
      concatMap(([processExitCode]) => {
        if (processExitCode !== undefined && processExitCode != command.expectedExitCode) {
          logger.debug(`${debugPrefix()} exited with ${processExitCode} but `
            + `${command.expectedExitCode} was expected`);

          return throwError(processFailed);
        }

        return of(null);
      }),
      concatMap(() => {
        return forkJoin(captures.map(capture => capture(monitoredProcess, triggerMatcher, triggerTimeout)))
          .pipe(
            throwIfEmpty(() => new Error('Nothing was captured')),
            tap(() => logger.debug(`${debugPrefix()} finished successfully`)),
            map(newMetricGroups => {
              // Aggregate metric groups into a single one.
              if (aggregatedMetricGroups.length === 0) {
                // Skip first since the first item is for the first run which
                // Which shound't be included for in  benchmarking
                aggregatedMetricGroups = [];
              } else {
                aggregatedMetricGroups = aggregatedMetricGroups.map((_, idx) =>
                  aggregateMetricGroups(aggregatedMetricGroups[idx], newMetricGroups[idx]),
                );
              }

              successfulRuns++;

              return aggregatedMetricGroups;
            }),
            tap(() => {
              const { cmd, cwd, args } = triggerCmd;

              spawn(cmd, args, { cwd });
            }),
            repeat(iterations + 1),
            retryWhen(errors => errors
              .pipe(concatMap(val => {
                // Otherwise check if we're still within the retry threshold.
                failedRuns += 1;
                if (failedRuns < retries) {
                  return of(val);
                }

                if (val === processFailed) {
                  return throwError(new MaximumRetriesExceeded(retries));
                }

                // Not really sure what happened here, just re-throw it.
                return throwError(val);
              })),
            ),
          );
      }),
      tap(groups => reporters.forEach(reporter => reporter(command, groups))),
      take(1),
    );
}
