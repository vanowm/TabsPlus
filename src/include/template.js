const template = (tags = {}) =>
{
	const _ = chrome.i18n.getMessage;
	Object.assign(tags, {
		undefined: new Proxy({/* extra html template tags defined here */},
			{
				get: (object, name) => (Object.hasOwnProperty.call(object, name) ? object[name] : _(name)),
			})
	});
	const i18n = (() =>
	{
		const i18nRegExp = /\${((\w+)\.)?([^}]+)}/g;
		const i18nRepl = (a, b, c, d) => tags[c][d];
		return text => text.replace(i18nRegExp, i18nRepl);
	})();

	const fixTags = node =>
	{
		if (node.attributes)
			for (let i = 0; i < node.attributes.length; i++)
				node.attributes[i].value = i18n(node.attributes[i].value);

		if (node.childNodes.length === 0)
			node.textContent = i18n(node.textContent);
		else
			for (let i = 0; i < node.childNodes.length; i++)
				fixTags(node.childNodes[i]);
	};
	fixTags(document.body.parentNode);
};