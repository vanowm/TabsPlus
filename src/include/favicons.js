/**
 * The Favicons module handles the management and retrieval of favicons for tabs.
 * It provides methods to update, add, and retrieve favicons.
 *
 * @module Favicons
 */
const Favicons = (() =>
{
	const cleanupInterval = 60_000; //clean up once a minute
	let previousUpdate;
	const favicons = {};
	SETTINGS.$inited.then(data =>
	{
		Object.assign(favicons, data.favicons.value);
		return data;
	}).catch(error => debug.error("SETTINGS.favicons error", error));
	/**
	 * Updates the favicons of tabs in a given tabs list.
	 *
	 * @param {Array} tabsList - The list of tabs to update favicons for.
	 * @param {Object} newFavicons - The object to store the new favicons.
	 * @param {Object} oldFavicons - The object to store the old favicons.
	 */
	const _updateFavicons = (tabsList, newFavicons, oldFavicons) =>
	{
		for(let i = 0; i < tabsList.length; i++)
		{
			const tab = tabsList[i].tab || tabsList[i];
			if (tab.window?.tabs)
			{
				_updateFavicons(tab.window.tabs, newFavicons, oldFavicons);
				continue;
			}

			const favIconUrl = tab.favIconUrl || _faviconsGet(tab.url);
			if (favIconUrl)
			{

				const hostname = _faviconsAdd(tab.url, favIconUrl);
				delete oldFavicons[tab.url];
				delete oldFavicons[hostname];
			}
		}
	};

	/**
	 * Adds a favicon URL to the favicons map.
	 * @param {string} url - The URL associated with the favicon.
	 * @param {string} favIconUrl - The URL of the favicon.
	 * @param {boolean} [save=false] - Indicates whether to save the updated favicons map.
	 * @param {Object} [map=favicons] - The map object to store the favicons.
	 * @returns {string} - The hostname extracted from the URL.
	 */
	const _faviconsAdd = (url, favIconUrl, save = false, map = favicons) =>
	{
		const hostname = new URL(url).hostname;
		map[url] = favIconUrl;
		map[hostname] = favIconUrl;
		if (save)
			_faviconsSave();

		return hostname;
	};

	const _faviconsSave = () => SETTINGS("favicons", favicons);

	/**
	 * Retrieves the favicon for a given URL.
	 * If the favicon is not found for the exact URL, it falls back to the favicon of the hostname.
	 *
	 * @param {string} url - The URL for which to retrieve the favicon.
	 * @returns {string|undefined} - The URL of the favicon, or undefined if not found.
	 */
	const _faviconsGet = url => favicons[url] || favicons[new URL(url).hostname];

	return {
		get: _faviconsGet,
		add: _faviconsAdd,
		save: _faviconsSave,
		update: async force =>
		{
			if (force
				|| !previousUpdate
				|| previousUpdate + cleanupInterval < Date.now())
			{
				previousUpdate = Date.now();
				const newFavicons = {};
				const oldFavicons = Object.assign({}, favicons);
				try
				{
					const sessions = await chrome.sessions.getRecentlyClosed();
					_updateFavicons(sessions, newFavicons, oldFavicons);
					const tabs = await chrome.tabs.query({});
					_updateFavicons(tabs, newFavicons, oldFavicons);
					console.debug("updateFaviconsCache", {force, sessions, newFavicons, oldFavicons, favicons, tabs});
					let save = false;
					for(const i in oldFavicons)
					{
						save = true;
						delete favicons[i];
					}

					for(const i in newFavicons)
					{
						save = true;
						break;
					}
					if (save)
					{
						Object.assign(favicons, newFavicons);
						_faviconsSave();
					}
				}
				catch(error)
				{
					debug.error(error);
				}
			}
			setAlarm(Favicons.update, cleanupInterval, "updateFaviconsCache");
			return true;
		}
	};
})();