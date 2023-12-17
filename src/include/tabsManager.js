/**
 * TabsManager class for managing browser tabs.
*/
// eslint-disable-next-line no-unused-vars
class TabsManager
{
	/**
	 * Constructs a new TabsManager object.
	 * @param {Map} [data=new Map()] - A map to hold the tab data.
	 */
	constructor (data = new Map())
	{
		this.tabsData = data;
		this.noChange = false;
		this.listeners = new Map();
		this.loaded = this.load();
		this.fields = {
			skip: true,
			id: false,
			windowId: false,
			windowUUID: false,
			tabUUID: false,
			groupId: true,
			/*these needed for uuid generation*/
			index: false,
			url: true,
			title: true,
			autoDiscardable: true,
			discarded: true,
			favIconUrl: true,
			pinned: true,
		};
	}

	/**
	 * Adds a tab to the manager.
	 * @param {Object} tab - The tab to add.
	 * @param {boolean} [save=true] - Whether to save the tab after adding.
	 * @param {boolean} [sort=true] - Whether to move the tab to the end of the list. Default is true.
	 * @returns {Object} The added tab.
	 */
	add (tab, save = true, sort = true)
	{
		const tabOld = sort ? this.remove(tab, false) || {} : tab; //move tab to the end of the list
		const newTab = this.update(tabOld, tab, true);
		this.tabsData.set(newTab.id, newTab);
		this.setUUID(newTab);
		this.setWinUUID(newTab);
		debug.trace("TAB.add", {id: tab.id, tabUUID: newTab.tabUUID, windowUUID: newTab.windowUUID, tab:CLONE(tab), newTab: CLONE(newTab), save, tabsData: [...this.tabsData.values()]});
		if (save)
			this.save();

		// setIcon(newTab);
		return newTab;
	}

	/**
	 * Removes a tab from the manager.
	 * @param {Object} tab - The tab to remove.
	 * @param {boolean} [save=true] - Whether to save the state after removing the tab.
	 * @returns {Object} The removed tab.
	 */
	remove (tab, save = true)
	{
		const tabData = this.tabsData.get(tab.id);
		this.tabsData.delete(tab.id);
		debug.trace("TAB.remove", {id: tab.id, tab:CLONE(tab), tabData:CLONE(tabData), save, tabsData: [...this.tabsData.values()]});
		if (save)
			this.save();

		return tabData;
	}

	/**
	 * Loads the tabs from the local storage.
	 */
	load ()
	{
		return chrome.storage.local.get(["tabsList", "tabsOrder"]);
	}

	/**
	 * Saves the current state of the tabs to the local storage.
	 * @returns {Promise} A promise that resolves when the save operation is complete.
	 */
	async save ()
	{
		const tabsList = [...this.tabsData.values()];
		const id = this.getUUID(Date.now());
		const tabsOrder = [];
		for(let i = 0, length = tabsList.length; i < length; i++)
		{
			tabsOrder.push(tabsList[i].tabUUID);
		}
		debug.trace("TABS.save", id, "" + [...this.tabsData.keys()], tabsList.map(a => CLONE(a)), CLONE(tabsOrder));
		try
		{
			const result = await chrome.storage.local.set({tabsList, tabsOrder});
			debug.trace("save alarm", id, result, "" + [...this.tabsData.keys()], tabsList.map(a => CLONE(a)), CLONE(tabsOrder));
			return result;
		}
		catch (error)
		{
			debug.error("TABS.save", error);
			throw error;
		}
	}

	/**
	 * Sets a UUID for a window based on the tabs it contains.
	 * @param {Object} tab - The tab to use for generating the UUID.
	 * @param {boolean} [save=true] - Whether to save the UUID to the tabs.
	 * @returns {string} The generated UUID.
	 */
	setWinUUID (tab, save = true)
	{
		const list = [...this.tabsData.values()];
		const uuidList = [];

		for(let i = 0, length = list.length; i < length; i++)
		{
			const listTab = list[i];
			if (listTab.windowId !== tab.windowId)
				continue;

			uuidList.push(listTab);
		}
		let uuid = "";
		uuidList.sort((a, b) => a.index - b.index);
		const uuidListLength = uuidList.length;
		for(let i = 0; i < uuidListLength; i++)
			uuid += uuidList[i].tabUUID;

		uuid = this.getUUID(uuid + uuidListLength);
		if (save)
		{
			for(let i = 0; i < uuidListLength; i++)
			{
				uuidList[i].windowUUID = uuid;
			}
		}
		return uuid;
	}

	/**
	 * Sets a UUID for a tab based on its properties.
	 * @param {Object} tab - The tab to use for generating the UUID.
	 * @param {boolean} [save=true] - Whether to save the UUID to the tab.
	 * @returns {string} The generated UUID.
	 */
	setUUID (tab, save = true)
	{
		const tabOrig = CLONE(tab);
		const data = [tab.url, /*tab.title, */tab.index, tab.autoDiscardable, /*tab.discarded,*/ tab.favIconUrl, tab.pinned, /*tab.groupId*/];
		tab.tabUUIDData = "" + data;
		const uuid = this.getUUID(data);
		// let uuid = "";
		// for(let i = 0; i < data.length; i++)
		// {
		// 	uuid = this.getUUID(uuid + data[i]);
		// }
		if (save)
			tab.tabUUID = uuid;

		debug.trace("TABS.setUUID", {tabOrig, tab, tabNew: CLONE(tab), save, uuid});
		return uuid;
	}

	/**
	 * Generates a UUID from a string.
	 * @param {string} string - The string to use for generating the UUID.
	 * @returns {string} The generated UUID.
	 */
	getUUID (string)
	{
		string = "" + string;
		let c = 0;
		let r = "";
		const stringLength = string.length;
		const halfStringLength = Math.max(0, stringLength / 2);

		for (let i = 0; i < stringLength; i++)
			c = (c + (string.charCodeAt(i) * (i + 1) - 1)) & 0xF_FF_FF_FF_FF_FF_FF;

		string = string.slice(halfStringLength) + c.toString(16) + string.slice(0, halfStringLength);
		for(let i = 0, p = c + stringLength; i < 32; i++)
		{
			if (i === 8 || i === 12 || i === 16 || i === 20)
				r += "-";

			p = (string[(i ** i + p + 1) % stringLength]).charCodeAt(0) + p + i;
			c = p;
			if (i === 12)
				c = (c % 5) + 1; //1-5
			else if (i === 16)
				c = (c % 4) + 8; //8-B
			else
				c %= 16; //0-F

			r += c.toString(16);
		}
		return r;
	}

	/**
	 * Finds a tab in the manager.
	 * @param {Object} tab - The tab to find.
	 * @returns {Object} The found tab, or undefined if the tab is not in the manager.
	 */
	find (tab)
	{
		return tab && this.tabsData.get(tab.id);
	}

	/**
	 * Updates a tab in the manager.
	 * @param {Object} dataOld - The old tab data.
	 * @param {Object} dataNew - The new tab data.
	 * @param {boolean} [overwrite=false] - Whether to overwrite the old data with the new data.
	 * @returns {Object} The updated tab data.
	 */
	update (dataOld, dataNew, overwrite = false)
	{
		if (!dataOld)
			return dataOld;

		for(const i in this.fields)
		{
			if (i in dataNew && (this.fields[i] || (!this.fields[i] && overwrite)))
				dataOld[i] = dataNew[i];
		}
		return dataOld;
	}

	/**
	 * Updates all tabs in the manager.
	 * @param {number} windowId - The ID of the window containing the tabs to update.
	 * @param {boolean} [save=true] - Whether to save the updated tabs.
	 * @returns {Promise} A promise that resolves when the update operation is complete.
	 */
	async updateAll (windowId, save = true)
	{
		debug.debug("TABS.updateAll", windowId);
		const query = {};
		if (windowId)
			query.windowId = windowId;

		const tabs = await chrome.tabs.query(query);
		for (let i = 0, length = tabs.length; i < length; i++)
		{
			const tab = this.update(this.find(tabs[i]), tabs[i], true);
			if (tab)
				this.setUUID(tab);
		}

		if (save)
			await this.save();

		return tabs;
	}

	/**
	 * Returns the last tab in a window that doesn't meet certain skip conditions.
	 * @param {number} windowId - The ID of the window to check.
	 * @param {boolean} skip - Whether to skip certain tabs.
	 * @param {Array} [skipIds=[]] - An array of tab IDs to skip.
	 * @returns {Object|null} The last tab that meets the conditions, or null if no such tab exists.
	 */
	last (windowId, skip, skipIds)
	{
		skipIds = skipIds || [];
		const list = [...this.tabsData.values()];
		debug.trace("TABS.last", windowId, skip, skipIds, list);
		for(let i = list.length - 1; i > -1; i--)
		{
			const tab = list[i];
			if (tab.windowId !== windowId)
				continue;

			if ((!skip || (skip && !tab.skip)) && !skipIds.includes(tab.id))
				return tab;
		}
		return null;
	}

	/**
	 * Activates the tab with the given ID.
	 * @param {number} tabId - The ID of the tab to activate.
	 * @returns {Promise} A promise that resolves with the updated tab object, or rejects with an error.
	 */
	async activate (tabId)
	{
		try
		{
			return await chrome.tabs.update(tabId, {active: true});
		}
		catch (error)
		{
			debug.error("TABS.activate", error);
		}
	}

	/**
	 * Deactivates a tab.
	 * @param {number} tabId - The ID of the tab to deactivate.
	 * @returns {Promise} A promise that resolves when the deactivation operation is complete.
	 */
	async deactivate (tabId)
	{
		try
		{
			return await chrome.tabs.update(tabId, {active: false});
		}
		catch (error)
		{
			debug.error("TABS.deactivate", error);
		}
	}

	/**
	 * Returns a JSON string of tabs in a window or windows.
	 * @param {number|Array} winId - The ID of the window to check, or an array of window IDs.
	 * @returns {string} A JSON string of tabs in the specified window(s).
	 */
	win (winId)
	{
		const winIds = (winId !== undefined && !(Array.isArray(winId))) ? [winId] : winId;
		const r = {};
		const tabs = [...this.tabsData.values()];

		for (let i = 0, length = tabs.length; i < length; i++)
		{
			const tab = CLONE(tabs[i]);
			const windowId = tab.windowId;

			if (winId && !winIds.includes(windowId))
				continue;

			if (!r[windowId])
				r[windowId] = [];

			delete tab.windowId;
			r[windowId].push(tab);
		}
		return JSON.stringify(r);
	}

	/**
	 * Adds a listener for a specific event type.
	 * @param {string} type - The type of the event to listen for.
	 * @param {Function} listener - The callback function to be invoked when the event is fired.
	 */
	addListener (type, listener)
	{
		let list = this.listeners.get(type);
		if (!list)
		{
			list = new Map();
			this.listeners.set(type, list);
		}
		list.set(listener, type);
	}

	/**
	 * Removes a listener for a specific event type.
	 * @param {string} type - The type of the event to remove the listener for.
	 * @param {Function} listener - The callback function to be removed.
	 */
	removeListener (type, listener)
	{
		const list = this.listeners.get(type);
		if (!list)
			return;

		list.delete(listener);
	}

	/**
	 * Notifies all listeners of a specific event type.
	 * @param {string} type - The type of the event to notify listeners of.
	 * @param {...any} args - The arguments to pass to the listeners.
	 */
	notifyListeners (type, ...args)
	{
		const list = this.listeners.get(type);
		if (!list || list.size === 0)
			return;

		for(let i = 0, listeners = [...list.keys()], length = listeners.length; i < length; i++)
			listeners[i](...args);
	}
} // class TabsList
