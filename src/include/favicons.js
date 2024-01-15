/**
 * The Favicons module handles the management and retrieval of favicons for tabs.
 * It provides methods to update, add, and retrieve favicons.
 *
 * @module favicons
 */
const FAVICONS = (() =>
{
	const cleanupInterval = 60_000; //clean up once a minute
	let previousUpdate;
	const faviconsList = {};
	Object.defineProperty(faviconsList, "saved", {value: false, writable: true, enumerable: false, configurable: false});
	SETTINGS.$inited.then(data =>
	{
		Object.assign(faviconsList, data.favicons.value);
		faviconsList.saved = true;
		return data;
	}).catch(error => debug.error("SETTINGS.favicons error", error));

	/**
	 * Updates the favicons of tabs in a given tabs list.
	 *
	 * @param {Array} tabsList - The list of tabs to update favicons for.
	 * @param {Object} newFavicons - The object to store the new favicons.
	 * @param {Object} oldFavicons - The object to store the old favicons.
	 */
	const updateFavicons = (tabsList, newFavicons, oldFavicons) =>
	{
		for(let i = 0; i < tabsList.length; i++)
		{
			const tab = tabsList[i].tab || tabsList[i];
			if (tab.window?.tabs)
			{
				updateFavicons(tab.window.tabs, newFavicons, oldFavicons);
				continue;
			}

			const favIconUrl = tab.favIconUrl || faviconsGet(tab.url);
			if (favIconUrl)
			{

				const hostname = faviconsAdd(tab.url, favIconUrl);
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
	const faviconsAdd = (url, favIconUrl, save = false, map = faviconsList) =>
	{
		const hostname = getHostname(url);
		if (map[url] !== favIconUrl || map[hostname] !== favIconUrl)
			map.saved = false;

		if (favIconUrl)
		{
			map[url] = favIconUrl;
			map[hostname] = favIconUrl;
		}
		else
		{
			delete map[url];
			delete map[hostname];
		}
		if (save && !map.saved)
			faviconsSave();

		return hostname;
	};

	/**
	 * Saves the favicons data to the settings.
	 */
	const faviconsSave = () => ((faviconsList.saved = true), SETTINGS("favicons", faviconsList));

	/**
	 * Updates the favicons cache.
	 * @param {boolean} force - Whether to force the update or not.
	 * @returns {Promise<boolean>} - A promise that resolves to true if the update was successful.
	 */
	const faviconsUpdate = async force =>
	{
		if (!force && previousUpdate && previousUpdate + cleanupInterval > Date.now())
			return setUpdate();

		previousUpdate = Date.now();
		const newFavicons = {};
		const oldFavicons = Object.assign({}, faviconsList);
		let sessions;
		let tabs;
		try
		{
			sessions = await chrome.sessions.getRecentlyClosed();
		}
		catch(error)
		{
			debug.error(error);
			return setUpdate();
		}
		updateFavicons(sessions, newFavicons, oldFavicons);
		try
		{
			tabs = await chrome.tabs.query({});
		}
		catch(error)
		{
			debug.error(error);
			return setUpdate();
		}
		updateFavicons(tabs, newFavicons, oldFavicons);
		console.debug("updateFaviconsCache", {force, sessions, newFavicons, oldFavicons, favicons: faviconsList, tabs});
		let save = !isEmpty(newFavicons);
		for(const i in oldFavicons)
		{
			save = true;
			delete faviconsList[i];
		}

		if (save)
		{
			Object.assign(faviconsList, newFavicons);
			faviconsSave();
		}
		return setUpdate();
	};

	/**
	 * Sets the update for favicons cache.
	 * @returns {boolean} Returns true after setting the update.
	 */
	const setUpdate = () => (setAlarm(faviconsUpdate, cleanupInterval, "updateFaviconsCache"), true);

	/**
	 * Retrieves the favicon for a given URL.
	 * If the favicon is not found for the exact URL, it falls back to the favicon of the hostname.
	 *
	 * @param {string} url - The URL for which to retrieve the favicon.
	 * @returns {string|undefined} - The URL of the favicon, or undefined if not found.
	 */
	const faviconsGet = url => faviconsList[url] || faviconsList[getHostname(url)];

	return {
		get: faviconsGet,
		add: faviconsAdd,
		save: faviconsSave,
		update: faviconsUpdate
	};
})();