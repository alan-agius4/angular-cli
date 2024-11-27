/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import ts from 'typescript';

export function lazyRouteTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext) => {
    const nodeFactory = context.factory;

    const visitor = (node: ts.Node): ts.Node => {
      if (!ts.isObjectLiteralExpression(node)) {
        return ts.visitEachChild(node, visitor, context);
      }

      let pathProp: ts.PropertyAssignment | undefined;
      let loadProp: ts.PropertyAssignment | undefined;

      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          if (prop.name.text === 'path') {
            pathProp = prop;
          }
          if (prop.name.text === 'loadChildren' || prop.name.text === 'loadComponent') {
            loadProp = prop;
          }
        }

        if (pathProp && loadProp) {
          break;
        }
      }

      if (
        !pathProp ||
        !loadProp ||
        !ts.isArrowFunction(loadProp.initializer) ||
        !ts.isCallExpression(loadProp.initializer.body) ||
        !ts.isPropertyAccessExpression(loadProp.initializer.body.expression) ||
        loadProp.initializer.body.expression.name.text !== 'then' ||
        !ts.isCallExpression(loadProp.initializer.body.expression.expression) ||
        loadProp.initializer.body.expression.expression.expression.kind !==
          ts.SyntaxKind.ImportKeyword
      ) {
        return ts.visitEachChild(node, visitor, context);
      }

      const importExpr = loadProp.initializer.body.expression.expression.arguments[0].getText();
      const importPathProp = nodeFactory.createPropertyAssignment(
        'ɵimportPath',
        nodeFactory.createBinaryExpression(
          nodeFactory.createBinaryExpression(
            nodeFactory.createBinaryExpression(
              nodeFactory.createBinaryExpression(
                nodeFactory.createTypeOfExpression(nodeFactory.createIdentifier('ngServerMode')),
                nodeFactory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
                nodeFactory.createStringLiteral('undefined'),
              ),
              nodeFactory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
              nodeFactory.createIdentifier('ngServerMode'),
            ),
            nodeFactory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
            nodeFactory.createParenthesizedExpression(
              nodeFactory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                nodeFactory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                nodeFactory.createCallExpression(
                  nodeFactory.createPropertyAccessExpression(
                    nodeFactory.createCallExpression(
                      nodeFactory.createIdentifier('import'),
                      undefined,
                      [nodeFactory.createIdentifier(importExpr)],
                    ),
                    nodeFactory.createIdentifier('then'),
                  ),
                  undefined,
                  [
                    nodeFactory.createArrowFunction(
                      undefined,
                      undefined,
                      [
                        nodeFactory.createParameterDeclaration(
                          undefined,
                          undefined,
                          nodeFactory.createObjectBindingPattern([
                            nodeFactory.createBindingElement(
                              undefined,
                              undefined,
                              nodeFactory.createIdentifier('ɵ__import_meta_url__'),
                            ),
                          ]),
                        ),
                      ],
                      undefined,
                      nodeFactory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                      nodeFactory.createIdentifier('ɵ__import_meta_url__'),
                    ),
                  ],
                ),
              ),
            ),
          ),
          nodeFactory.createToken(ts.SyntaxKind.BarBarToken),
          nodeFactory.createIdentifier('undefined'),
        ),
      );

      return nodeFactory.updateObjectLiteralExpression(node, [...node.properties, importPathProp]);
    };

    return (sourceFile) => {
      if (!sourceFile.text.includes('loadComponent') && !sourceFile.text.includes('loadChildren')) {
        return sourceFile;
      }

      return ts.visitEachChild(sourceFile, visitor, context);
    };
  };
}
