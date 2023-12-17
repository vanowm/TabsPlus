module.exports = {
	extends: [
		"stylelint-config-standard",
		"stylelint-config-idiomatic-order"
	],
	plugins: [
		"stylelint-group-selectors",
	],
	rules: {
		"custom-property-pattern": null,
		"selector-class-pattern": null,
		"selector-id-pattern": null,
		"selector-not-notation": null,
		"selector-type-no-unknown": null,
		"property-no-vendor-prefix": null,
		"comment-empty-line-before": null,
		"value-no-vendor-prefix": null,
		"string-quotes": "double",
		"indentation": ["tab", {indentInsideParens: "once-at-root-twice-in-block"}],
		"plugin/stylelint-group-selectors": true,
		"block-opening-brace-newline-before": "always-multi-line",
		"block-opening-brace-newline-after": "always-multi-line",
	},
  };
