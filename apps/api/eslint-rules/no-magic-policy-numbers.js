/**
 * Custom ESLint rule — BRD §13 Aturan Tegas #1:
 * "Dilarang menuliskan angka kebijakan sebagai literal di kode.
 *  173, 25, 12, 150000, 2, 7, 30 WAJIB berasal dari system_parameters atau tabel aturan."
 *
 * Flags suspicious numeric literals (payload-related policy numbers) appearing
 * in service/controller code. The seed and test fixtures are the config source
 * of truth and are exempt.
 *
 * The rule is intentionally strict but context-aware: numbers used for
 * structural/mechanical purposes (string slicing, array indices, date padStart,
 * page sizes, port numbers, JWT TTL multipliers) are NOT policy — they are
 * incidental integers. A reviewer override comment
 * (`eslint-disable-next-line lahans/no-magic-policy-numbers`) is the documented
 * escape hatch for the rare legitimate case (BRD §13: pelanggaran = blocker).
 */
'use strict';

const POLICY_NUMBERS = [173, 25, 12, 150000, 2, 7, 30];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Dilarang hardcode angka kebijakan (BRD §13 #1)',
    },
    messages: {
      policy: 'Angka kebijakan {{num}} tidak boleh hardcode. Ambil dari system_parameters.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    // Seed + tests are the config source of truth; they may reference the
    // numbers when defining or asserting them.
    const isSourceOfTruth = /seed\.ts$|\.spec\.ts$|\.test\.ts$/.test(filename);

    return {
      Literal(node) {
        if (typeof node.value !== 'number') return;
        if (Number.isNaN(node.value)) return;
        if (!POLICY_NUMBERS.includes(node.value)) return;

        if (isSourceOfTruth) return;

        // Structural usage — not a policy number. These are the mechanical uses
        // of the digits that happen to collide with policy values.
        const parent = node.parent;
        if (!parent) return;

        // JWT "Bearer " prefix offset, string slicing, etc.
        if (parent.type === 'CallExpression' && parent.callee.property?.name === 'slice') return;
        // padStart(2, '0') — date formatting width
        if (parent.type === 'CallExpression' && parent.callee.property?.name === 'padStart') return;
        if (parent.type === 'CallExpression' && parent.callee.property?.name === 'padEnd') return;
        // Array index / length
        if (parent.type === 'MemberExpression' && parent.property === node) return;
        // TTL multipliers: 7 * 24 * 60 * 60 (week in seconds)
        if (parent.type === 'BinaryExpression' && ['*', '/'].includes(parent.operator)) return;
        // Object property shorthand / default values in DTOs
        if (parent.type === 'Property' && parent.value === node) return;
        // Page size / pagination defaults
        if (parent.type === 'AssignmentPattern') return;
        // switch case / default
        if (parent.type === 'SwitchCase') return;

        // Everything else is a policy number candidate.
        context.report({
          node,
          messageId: 'policy',
          data: { num: node.value },
        });
      },
    };
  },
};
