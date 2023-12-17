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