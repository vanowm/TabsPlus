const template = (tags = {}) =>
{
	Object.assign(tags, {
		undefined: new Proxy({/* extra html template tags defined here */},
			{
				get: (object, name) => (Object.hasOwnProperty.call(object, name) ? object[name] : i18n(name)),
			})
	});
	const regExp = /\${(?:(\w+)\.)?([^}]+)}/g;
	const repl = (a, b, c) => tags[b][c];
	const i18nReplace = text => text.replace(regExp, repl);

	const fixTags = node =>
	{
		if (node.attributes)
			for (let i = 0; i < node.attributes.length; i++)
				node.attributes[i].value = i18nReplace(node.attributes[i].value);

		if (node.childNodes.length === 0)
			node.textContent = i18nReplace(node.textContent);
		else
			for (let i = 0; i < node.childNodes.length; i++)
				fixTags(node.childNodes[i]);
	};
	fixTags(document.body.parentNode);
};