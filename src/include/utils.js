/**
 * The manifest object of the Chrome extension.
 * @type {object}
 */
const APP = chrome.runtime.getManifest();

/**
 * Creates a shallow copy of an object.
 *
 * @param {Object} object - The object to be cloned.
 * @returns {Object} - The cloned object.
 */

const CLONE = object => Object.assign(Array.isArray(object) ? [] : {}, object);
/**
 * Truncates a string to a specified length.
 * If the string is longer than the specified length, it adds an ellipsis (...) in the middle.
 * @param {string} string_ - The string to truncate.
 * @param {number} [n=50] - The maximum length of the truncated string.
 * @returns {string} The truncated string.
 */
const truncate = (string_, n = 50) =>
{
	string_ = "" + string_;
	return string_.length > n ? string_.slice(0, Math.max(0, (n / 2) - 1)) + "…" + string_.slice(string_.length - (n / 2) + 2, string_.length) : string_;
//  return (this.length > n) ? this.substr(0, n-1) + '…' : this.toString();
};

/**
 * Pads a string with leading zeros.
 *
 * @param {string|number} s - The string or number to pad.
 * @param {number} [n=2] - The desired length of the padded string.
 * @returns {string} The padded string.
 */
const pad = (s, n = 2) => ("" + s).padStart(n, 0);

const Void = () => {};

/**
 * Performs a bitwise AND operation on 64bit numbers.
 *
 * @link https://stackoverflow.com/a/43666199/2930038
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} - The result of the bitwise AND operation.
 */
const BitWiseAnd = (a, b) => (~~(a / 0x80_00_00_00) & ~~(b / 0x80_00_00_00)) * 0x80_00_00_00 + ((a & 0x7F_FF_FF_FF) & (b & 0x7F_FF_FF_FF));

/**
 * Compares two versions.
 *
 * @link https://jsfiddle.net/vanowm/p7uvtbor/
 * @param {string} a - The first version to compare.
 * @param {string} b - The second version to compare.
 * @returns {number} - Returns -1 if `a` is less than `b`, 1 if `a` is greater than `b`, or 0 if they are equal.
 */
const compareVersions = ((prep, l, i, r) => (a, b) =>
{
	a = prep(a);
	b = prep(b);
	l = Math.max(a.length, b.length);
	i = 0;
	r = i;
	while (!r && i < l)
		r = ~~a[i] - ~~b[i++];

	// eslint-disable-next-line no-nested-ternary
	return r < 0 ? -1 : (r ? 1 : 0);
})(t => ("" + t)
	.replace(/[^\d.]+/g, c => "." + (c.replace(/[\W_]+/, "").toUpperCase().charCodeAt(0) - 65_536) + ".")
	.replace(/(?:\.0+)*(\.-\d+(?:\.\d+)?)\.*$/g, "$1")
	.split("."));

/**
 * Centers a string within a specified limit by adding a filler character on both sides.
 * @param {string} string - The string to be centered.
 * @param {number} [limit=75] - The maximum length of the centered string.
 * @param {string} [filler="-"] - The character used to fill the space on both sides of the string.
 * @returns {string} The centered string.
 */
const centerString = (string, limit = 75, filler = "-") =>
{
	const padLength = ~~((limit - string.length) / 2);
	return string.padStart(string.length + padLength, filler).padEnd(string.length + padLength * 2, filler);
};

/**
 * Checks if the input is empty.
 * @param {string|array|Object} input - The input to check.
 * @returns {boolean} True if the input is empty, false otherwise.
 */
const isEmpty = input =>
{
	if (input === null || input === undefined)
		return true;

	if (typeof input === "string" || Array.isArray(input))
		return input.length === 0;

	if (typeof input === "object")
	{
		for (const key in input)
		{
			if (Object.prototype.hasOwnProperty.call(input, key))
				return false;
		}
		return true;
	}

	return false;
};

/**
 * Returns the stack trace.
 *
 * @param {string} txt - The message.
 * @returns {string} - The stack trace.
 */
// eslint-disable-next-line unicorn/error-message, unicorn/new-for-builtins
const trace = txt => Error(txt).stack.replace(/^\w+(?:: (.*))?\n.*\n.*/m, "$1");

/**
 * Internationalization utility for retrieving localized messages.
 * @type {Function}
 */
const i18n = (() =>
{
	const cache = {};
	return new Proxy(name => cache[name] || (cache[name] = chrome.i18n.getMessage(name)),
		{
			get: (target, name) => target(name),
			set: () => true
		});
})();

const getHostname = url =>
{
	try
	{
		return new URL(url).hostname;
	}
	catch
	{
		debug.error(url, trace());
		return "";
	}
};
