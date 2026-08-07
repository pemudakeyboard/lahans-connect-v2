/**
 * Custom ESLint rule — BRD §13 Aturan Tegas #2:
 * "Dilarang memeriksa nama/kode grup di logic (`if (user.group === 'COMBEN')`).
 *  Gunakan pemeriksaan permission."
 *
 * Flags code that compares a value against a known group-code literal
 * (e.g. `group === 'COMBEN'`, `user.groups.includes('SUPER_ADMIN')`).
 * Permission checks (`permissions.includes('...')`) are the only allowed form.
 */
'use strict';

const GROUP_CODES = ['SUPER_ADMIN', 'HCGA_MANAGER', 'COMBEN', 'FINANCE', 'EMPLOYEE'];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Dilarang memeriksa nama/kode grup (BRD §13 #2) — gunakan permission',
    },
    messages: {
      group:
        "Jangan periksa kode grup '{{code}}'. Gunakan pemeriksaan permission, bukan nama grup (BRD §13 #2).",
    },
  },
  create(context) {
    return {
      'BinaryExpression[operator="==="]'(node) {
        checkOperand(node.left, node.right, context);
        checkOperand(node.right, node.left, context);
      },
      'BinaryExpression[operator="=="]'(node) {
        checkOperand(node.left, node.right, context);
        checkOperand(node.right, node.left, context);
      },
      'CallExpression[callee.property.name="includes"]'(node) {
        const args = node.arguments;
        if (args.length === 1 && args[0].type === 'Literal' && typeof args[0].value === 'string') {
          if (GROUP_CODES.includes(args[0].value)) {
            context.report({
              node: args[0],
              messageId: 'group',
              data: { code: args[0].value },
            });
          }
        }
      },
    };
  },
};

function checkOperand(node, otherNode, context) {
  if (node.type !== 'Literal' || typeof node.value !== 'string') return;
  if (!GROUP_CODES.includes(node.value)) return;
  // Skip if the comparison is against a permission code (allowed).
  if (otherNode.type === 'Literal' && typeof otherNode.value === 'string') return;
  context.report({
    node,
    messageId: 'group',
    data: { code: node.value },
  });
}
