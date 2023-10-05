import { getGlobalVariable } from '../../utils/env';
import { expectFileToExist } from '../../utils/fs';
import { expectGitToBeClean } from '../../utils/git';
import { ng } from '../../utils/process';

export default async function () {
  await ng('build', '--stats-json', '--configuration=development');
  if (getGlobalVariable('argv')['esbuild']) {
    // esbuild uses an 8 character hash and a dash as separator
    await expectFileToExist('./dist/test-project/stats.json');
  } else {
    await expectFileToExist('./dist/test-project/browser/stats.json');
  }
  await expectGitToBeClean();
}
