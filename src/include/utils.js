/* eslint-disable no-unused-vars */
const APP = chrome.runtime.getManifest();
const CLONE = object => Object.assign({}, object);
const truncate = (string_, n = 50) =>
{
	string_ = "" + string_;
	return string_.length > n ? string_.slice(0, Math.max(0, (n / 2) - 1)) + "…" + string_.slice(string_.length - (n / 2) + 2, string_.length) : string_;
//  return (this.length > n) ? this.substr(0, n-1) + '…' : this.toString();
};

const pad = (s, n = 2) => ("" + s).padStart(n, 0);

const Void = () => {};

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