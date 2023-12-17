const preventAbbreviations = {
	"args": true,
	"el": true,
	"evt": true,
	"i": true,
	"j": true
};
const combine = (objectA, objectB) => Object.assign({}, objectA, objectB);

module.exports = {
	"env": {
		"browser": false,
		"es6": true,
		"node": true,
	},
	"extends": [
		"eslint:recommended",
		"plugin:sonarjs/recommended",
		"plugin:eslint-comments/recommended",
		"plugin:promise/recommended",
		"plugin:unicorn/recommended",
		"plugin:import/errors",
		"plugin:import/warnings",
		"plugin:import/typescript" // make sure you add this one for ts projects
	],
	"globals": {
		"STORAGE": "writable",
		"debug": true,
		"TabsManager": true,
		"setAlarm": true,
		"TABS": true,
		"CLONE": true,
		"prefs": true,
		"prefsInited": true,
		"prefsSave": true,
		"pad": true,
		"ACTION_FREEZE": true,
		"ACTION_UNFREEZE": true,
		"ACTION_UNDO": true,
		"ACTION_SKIP": true,
		"ACTION_LIST": true,
		"ACTION_UNLOAD_TAB": true,
		"ACTION_UNLOAD_WINDOW": true,
		"ACTION_UNLOAD_ALL": true,
		"truncate": true,
		"ACTIONPROPS": true,
		"messenger": true,
		"contextMenu": true,
		"APP": true,
		"setIcon": true,
		"setContext": true,
		"Void": true,
	},

	"ignorePatterns": [
		"!dist/*",
		"!.git/hooks/*",
	],
	"overrides": [

// CSS
		{
			"env": {
				"browser": true,
			},
			"extends": [
				"eslint:recommended",
				"plugin:sonarjs/recommended",
				"plugin:unicorn/recommended",
				"plugin:css/all"
			],
			"files": "**/*.css",
			"plugins": [
				"css",
				"css-custom-properties"
			],
			"rules": {
				"css/at-rule-no-unknown": "error",
				"css/rule-name": "error",
			}
		},

// NODE
		{
			"env": {
				"browser": false
			},
			"files": [
				"dist/.git/hooks/*",
				"tools/**/*.js",
				"**/apiEncoder.js",
				"www/**/*",
				"*.js"
			],
			"rules": {
				"unicorn/prefer-module": "off",
				"unicorn/prevent-abbreviations": [
					"error",
					{
						"allowList": combine(preventAbbreviations, {
							"commit-msg": true
						})
					}
				]
			}
		},

// WEBEXTENSIONS
		{
			"env": {
				"browser": true,
				"webextensions": true,
				"serviceworker": true,
				"worker": true,
				"node": false
			},
			"files": [
				"dist/**/*.js",
				"src/**/*.js",
			],
			"rules": {
				// "sonarjs/cognitive-complexity": "off",
			}
		},

// JSON
		{
			"env": {
				"browser": false
			},
			"extends": [
				"plugin:json-schema-validator/recommended",
				"plugin:jsonc/all"
			],
			"files": "**/*.{json,jsonc,json5,code-workspace}",
			"parser": "jsonc-eslint-parser",
			"plugins": [
				"jsonc",
				"json-schema-validator"
			],
			"rules":
			{
				"json-schema-validator/no-invalid": "error",
				"jsonc/indent": [
					"error",
					"tab"
				],
				"jsonc/key-name-casing": "off"
			}
		},

	],
	"parserOptions": {
		"ecmaVersion": "latest"
	},
	"plugins": [
		"sonarjs",
		"promise",
		"import",
		"unicorn",
		"prefer-arrow-functions"
	],
	"root": true,
	"rules": {
		"arrow-body-style": [
			"error",
			"as-needed",
			{
				"requireReturnForObjectLiteral": true
			}
		],
		"arrow-parens": [
			"error",
			"as-needed"
		],
		"arrow-spacing": "error",
		"brace-style": [
			"error",
			"allman",
			{
				"allowSingleLine": true
			}
		],
		// "curly": "off",
		"eqeqeq": "error",
		"eslint-comments/disable-enable-pair": [
			"error",
			{
				"allowWholeFile": true
			}
		],
		"indent": [
			"error",
			"tab",
			{
				"SwitchCase": 1,
				"ignoreComments": true,
				// "outerIIFEBody": 0, //no tabs need in first function
			}
		],
		"max-statements-per-line": [
			"error",
			{
				"max": 1
			}
		],
		"no-array-constructor": "error",
		"no-catch-shadow": "error",
		"no-compare-neg-zero": "error",
		"no-cond-assign": "warn",
		"no-confusing-arrow": "error",
		"no-const-assign": "error",
		"no-constant-condition": [
			"error",
			{
				"checkLoops": false
			}
		],
		"no-dupe-args": "error",
		"no-dupe-class-members": "error",
		"no-dupe-keys": "error",
		"no-duplicate-case": "error",
		"no-else-return": "error",
		"no-empty": [
			"error",
			{
				"allowEmptyCatch": true
			}
		],
		"no-empty-character-class": "error",
		"no-empty-pattern": "error",
		"no-eq-null": "error",
		"no-extra-bind": "error",
		"no-extra-boolean-cast": "error",
		"no-extra-label": "error",
		"no-extra-semi": "error",
		"no-inner-declarations": "error",
		"no-invalid-regexp": "error",
		"no-irregular-whitespace": "error",
		"no-lonely-if": "error",
		"no-mixed-spaces-and-tabs": "error",
		"no-multi-assign": "error",
		"no-multi-spaces": "error",
		"no-multi-str": "error",
		"no-multiple-empty-lines": [
			"error",
			{
				"max": 1
			}
		],
		"no-prototype-builtins": "error",
		"no-redeclare": "error",
		"no-self-compare": "error",
		"no-shadow": [
			"error",
			{
				"allow": [
					"i",
					"evt"
				]
			}
		],
		"no-spaced-func": "error",
		"no-sparse-arrays": "error",
		"no-throw-literal": "error",
		"no-trailing-spaces": "error",
		"no-undef": "error",
		"no-unexpected-multiline": "error",
		"no-unreachable": "warn",
		"no-unused-expressions": [
			"warn",
			{
				"allowShortCircuit": true
			}
		],
		"no-unused-vars": ["warn", { "vars": "local" }],
		"no-useless-computed-key": "error",
		"no-useless-concat": "error",
		"no-useless-constructor": "error",
		"no-useless-escape": "error",
		"no-useless-rename": "error",
		"no-useless-return": "error",
		"no-var": "error",
		"no-whitespace-before-property": "error",
		"one-var": [
			"error",
			"never"
		],
		"prefer-arrow-functions/prefer-arrow-functions": [
			"warn",
			{
				"allowNamedFunctions": false,
				"classPropertiesAllowed": false,
				"disallowPrototype": false,
				"returnStyle": "unchanged",
				"singleReturnOnly": false
			}
		],
		"prefer-arrow-callback": "error",
		"prefer-const": "error",
		// "prefer-template": "off", // allow "string" + "string"
		"promise/always-return": "error",
		// "promise/avoid-new": "warn",
		"promise/catch-or-return": "error",
		"promise/no-callback-in-promise": "warn",
		// "promise/no-native": "off",
		"promise/no-nesting": "warn",
		"promise/no-new-statics": "error",
		"promise/no-promise-in-callback": "warn",
		"promise/no-return-in-finally": "warn",
		"promise/no-return-wrap": "error",
		"promise/param-names": "error",
		"promise/valid-params": "warn",
		"quotes": [
			"error",
			"double",
			{
				"allowTemplateLiterals": true,
				"avoidEscape": true
			}
		],
		"semi": "error",
		"sonarjs/cognitive-complexity": "off",
		// "sonarjs/no-duplicate-string": "off",
		"space-before-function-paren": "error",
		// "no-empty-function": "error",
		// "no-extra-parens": ["error", "all", {"nestedBinaryExpressions": false}],
		// "no-invalid-this": ["error", {"capIsConstructor": true}],
		// "no-magic-numbers": ["error", {"ignore": [0, 1], "ignoreArrayIndexes": true}],
		"no-negated-condition": "error",
		"no-nested-ternary": "error",
		"no-return-assign": "error",
		"space-infix-ops": "error",
		"unicorn/filename-case": "off",
		"unicorn/no-array-callback-reference": "off",
		"unicorn/no-for-loop": "off",
		"unicorn/no-null": "off",
		// "unicorn/no-new-array": "off",
		// "unicorn/prefer-at": "off",
		"unicorn/prefer-code-point": "off",
		"unicorn/prefer-keyboard-event-key": "off",
		"unicorn/prefer-math-trunc": "off",
		"unicorn/prefer-query-selector": "off",
		"unicorn/prefer-string-replace-all": "off",
		"unicorn/prefer-top-level-await": "off",
		"unicorn/prevent-abbreviations": [
			"error",
			{
				"allowList": preventAbbreviations
			}
		]
	},

	"settings": {}
};
