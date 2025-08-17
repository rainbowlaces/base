/**
 * ESLint rule: no-self-referential-config
 * Flags patterns that caused temporal-dead-zone issues:
 *  - @configClass(thunk(() => SomeClass))
 *  - @config(thunk(() => SomeClass))
 * These force immediate evaluation of a thunk capturing the class identifier
 * before the class is initialized. Use a string namespace instead.
 */

export const noSelfReferentialConfig = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow self-referential thunk usage in @configClass/@config decorators',
    },
    schema: [],
    messages: {
      selfRef: 'Avoid self-referential thunk in {{decorator}}. Use a string name: @{{decorator}}("ClassName").'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        // Look for configClass(thunk(() => Identifier)) pattern
        if (node.callee.type === 'Identifier' && (node.callee.name === 'configClass' || node.callee.name === 'config')) {
          if (node.arguments.length === 1) {
            const arg = node.arguments[0];
            if (arg.type === 'CallExpression' && arg.callee.type === 'Identifier' && arg.callee.name === 'thunk') {
              // Expect single arrow function returning Identifier
              if (arg.arguments.length === 1) {
                const thunkArg = arg.arguments[0];
                if (thunkArg.type === 'ArrowFunctionExpression' && thunkArg.body.type === 'Identifier') {
                  context.report({ node: arg, messageId: 'selfRef', data: { decorator: node.callee.name } });
                }
              }
            }
          }
        }
      }
    };
  }
};

