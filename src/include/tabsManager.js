/**
 * TabsManager class for managing browser tabs.
*/
class TabsManager
{
	/**
	 * Constructs a new TabsManager object.
	 * @param {Map} [data=new Map()] - A map to hold the tabs data.
	 */
	constructor (data = new Map())
	{
		this.tabsData = data;
		this.noChange = false;
		this.listeners = new Map();
		this.loaded = this.load();

		// list of properties to copy from the TAB object
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
		for(const i in this.tabsHandler)
			chrome.tabs[i]?.addListener(this.onWrapper(this.tabsHandler[i]));

	}

	onWrapper (callback)
	{
		return (...args) => SETTINGS.$inited.then(() => callback.apply(callback, args));
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
		const newTab = this.updateData(tabOld, tab, true);
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
		// const tabsList = [...this.tabsData.values()];
		const id = this.getUUID(Date.now());
		const tabsOrder = [];
		// for(let i = 0, length = tabsList.length; i < length; i++)
		for(const tab of this.tabsData)
		{
			tabsOrder.push(tab[1].tabUUID);
		}
		debug.trace("this.save", id, "" + [...this.tabsData.keys()], [...this.tabsData.values()].map(a => CLONE(a)), CLONE(tabsOrder));
		try
		{
			const result = await chrome.storage.local.set({tabsList: [...this.tabsData.values()], tabsOrder});
			debug.trace("save alarm", id, result, "" + [...this.tabsData.keys()], [...this.tabsData.values()].map(a => CLONE(a)), CLONE(tabsOrder));
			return result;
		}
		catch (error)
		{
			debug.error("this.save", error);
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
		// const list = [...this.tabsData.values()];
		const uuidList = [];

		// for(let i = 0, length = list.length; i < length; i++)
		for(const tabData of this.tabsData)
		{
			// const listTab = list[i];
			if (tabData[1].windowId !== tab.windowId)
				continue;

			uuidList.push(tabData[1]);
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
		const data = [tab.url, /*tab.title, */tab.index, tab.autoDiscardable, /*tab.discarded,*/ /*tab.favIconUrl,*/ tab.pinned, /*tab.groupId*/];
		tab.tabUUIDData = "" + data;
		const uuid = this.getUUID(data);
		// let uuid = "";
		// for(let i = 0; i < data.length; i++)
		// {
		// 	uuid = this.getUUID(uuid + data[i]);
		// }
		if (save)
			tab.tabUUID = uuid;

		debug.trace("this.setUUID", {tabOrig, tab, tabNew: CLONE(tab), save, uuid});
		return uuid;
	}

	/**
	 * Generates a UUID from a string.
	 * @url https://jsfiddle.net/vanowm/4sg813qt/
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

		const max = 0xF_FF_FF_FF_FF_FF_FF;
		for (let i = 0; i < stringLength; i++)
		{
			c = c + (string.charCodeAt(i) * (i + 1) - 1);
			if (c > max)
				c = BitWiseAnd(c, max);
		}

		string = string.slice(halfStringLength) + c.toString(16) + string.slice(0, halfStringLength);
		for(let i = 0, p = c + stringLength; i < 32; i++)
		{
			if (i === 8 || i === 12 || i === 16 || i === 20)
				r += "-";

			p = (string[(i ** i + p + 1) % stringLength]).charCodeAt(0) + p + i;
			c = p;
			// if (i === 12)
			// 	c = (c % 5) + 1; //1-5
			// else if (i === 16)
			// 	c = (c % 4) + 8; //8-B
			// else
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
	updateData (dataOld, dataNew, overwrite = false)
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
		debug.debug("this.updateAll", windowId);
		const query = {};
		if (windowId)
			query.windowId = windowId;

		const tabs = await chrome.tabs.query(query);
		for (let i = 0, length = tabs.length; i < length; i++)
		{
			const tab = this.updateData(this.find(tabs[i]), tabs[i], true);
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
		debug.trace("this.last", windowId, skip, skipIds, list);
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
			debug.error("this.activate", error);
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
			debug.error("this.deactivate", error);
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
		// const tabs = [...this.tabsData.values()];

		// for (let i = 0, length = tabs.length; i < length; i++)
		for( const tabData of this.tabsData)
		{
			const tab = CLONE(tabData[1]);
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

	nextActionMap = {};

	nextAction = new Proxy((event, command, data) =>
	{
		if (!command)
			return this.nextActionMap[event];

		if (!this.nextActionMap[event])
			this.nextActionMap[event] = {};

		this.nextActionMap[event][command] = data;
		return false;
	},
	{
		get: (target, event) => target(event),
		set: (target, event, value) => target(event, value),
	});

	/**
	 * Event handler functions for various tab-related events.
	 * @type {Object}
	 */
	tabsHandler = {
		onActivated: activeInfo =>
		{
			// if (onRemoveTab.unload && onRemoveTab.unload !== activeInfo.tabId)
			// {
			// 	onRemoveTab.noUnload = true;
			// 	chrome.tabs.discard(onRemoveTab.unload);
			// 	delete onRemoveTab.unload;
			// }
			const noChange = this.noChange;
			debug.trace("onActivated", activeInfo.tabId, {activeInfo, noChange, "this.noChange": this.noChange, "settings.tabsScrollFix": SETTINGS.tabsScrollFix});
			// setAlarm(() =>
			// {
			debug.debug("onActivated onAlarm", {activeInfo, noChange, "this.noChange": this.noChange});
			if (noChange)
				return noChange instanceof Function && noChange();

			this.notifyListeners("activated", activeInfo);
			this.tabsGet(activeInfo.tabId, tab =>
			{
				tab = this.add(tab);
				debug.debug("activated", activeInfo.tabId, this.win(), tab);
				// CONTEXTMENU.setContext(tab);
			});
			//    }, settings.newTabActivate == 1 && settings.tabsScrollFix ? noChange ? 200 : 300 : 0, "onActivated");
		}, //onActivated()

		onCreated: async tab =>
		{
			const isRestored = (tab.pendingUrl && tab.pendingUrl === tab.url)
								|| (!tab.pendingUrl && tab.status === "unloaded");

			const isNewWindow = this.nextAction?.onCreate?.newWindow;
			debug.debug("onCreated", isRestored, {tab: CLONE(tab), isNewWindow});
			delete this.nextAction?.onCreate?.newWindow;
			console.log(this.nextActionMap);
			if (isRestored || isNewWindow) //tab restored?
			{
				if (isNewWindow)
				{
					const data = {
						tabId: tab.id
					};
					// if (SETTINGS.newTabActivate)
					// 	data.focused = SETTINGS.newTabActivate === 1;

					chrome.tabs.query({windowId: tab.windowId}, tabs => tabs.length > 1 && chrome.windows.create(data));
				}
				else
					return;
			}
			let previousTab = this.last(tab.windowId);
			this.add(tab);
			if (!previousTab)
				previousTab = tab;

			const url = tab.url || tab.pendingUrl || "";
			const match = url.match(/^(chrome|edge):\/\/(newtab)?/i) || [];
			const isOptions = new RegExp("^chrome-extension://" + chrome.runtime.id + "/.*", "i").exec(url);
			const isChrome = match[1];
			const isNewPage = match[2];
			const isForeground = (SETTINGS.newTabActivate === 1 && (!SETTINGS.newTabPageOnly || (SETTINGS.newTabPageOnly && isNewPage))) || isOptions;
			const isBackground = SETTINGS.newTabActivate === 2 && !isOptions;

			if (previousTab.id !== tab.id)
			{

				let index = tab.index;

				const first = await chrome.tabs.query({pinned: true, currentWindow: true});
				const last = await chrome.tabs.query({currentWindow: true});

				try
				{
					previousTab = await chrome.tabs.get(previousTab.id);
				}
				catch(error)
				{
					debug.error("onCreated tabs.get", previousTab.id, error);
				}
				switch(SETTINGS.newTabPosition)
				{
					case 1: { //first
						index = first.length;
						break;
					}
					case 2: { //next left
						index = Math.max(first.length, previousTab.index);
						break;
					}
					case 3: { //next right
						index = Math.min(previousTab.index + 1, last.length - 1);
						break;
					}
					case 4: { //last
						index = last.length - 1;
						break;
					}
				}
				// eslint-disable-next-line unicorn/no-await-expression-member
				debug.debug("onCreated position", {settingNewTabPosition: SETTINGS.newTabPosition, tabIndex: tab.index, prevTabIndex: previousTab.index,index, first: (await first).length, last: (await last).length - 1, prevTabId: previousTab.id, tabId: tab.id, prevTab: previousTab, tab});

				// without setTimeout it scrolls page down when link opens a new tab (and AutoControl installed https://chrome.google.com/webstore/detail/autocontrol-custom-shortc/lkaihdpfpifdlgoapbfocpmekbokmcfd )
				// looks like it's fixed now
				// setTimeout(() => {
				if (isForeground || isBackground)
				{
					await new Promise(resolve =>
					{
						if (!SETTINGS.newTabPosition || tab.index === index)
							return resolve();

						chrome.tabs.move(tab.id, {index})
							.then(result =>
							{
								resolve(true);
								return result;
							})
							.catch(error => (resolve(), debug.error("onCreated.move", error)));
					});

					const wait = new Promise(resolve => (this.noChange = resolve));
					debug.debug("noChange", "true", {noChange: this.noChange, prevTabId: previousTab.id, tabId: tab.id, prevTab: previousTab, tab});
					this.activate(previousTab.id);
					if (previousTab.active)
						this.noChange();

					await wait;
					this.noChange = false;
				}
			}
			// }, 35);

			// fix for EDGE vertical tabs don't scroll to the new tab
			// https://github.com/MicrosoftDocs/edge-developer/issues/1276
			// https://github.com/microsoft/MicrosoftEdge-Extensions/discussions/125
			setAlarm(() =>
			{

				debug.debug("noChange", "false", {noChange: this.noChange, isChrome, isNewPage, isForeground, isBackground, newTabPageOnly: SETTINGS.newTabPageOnly, tab});
				if (isForeground || isBackground)
				{
					// //move new tab to the front of the list
					// const t = this.tabsData.get(tab.id);
					// this.tabsData.delete(tab.id);
					// this.tabsData.set(tab.id, t);

					//remove this block to skip to new tab when delete
				}
				if (SETTINGS.newTabPageSkip && !isForeground)
				{
					// for(let i = 0, list = [...this.tabsData.values()]; i < list.length; i++)
					for(const tabData of this.tabsData)
					{
						const value = tabData[1];
						if (value.id === tab.id)
							continue;

						this.tabsData.delete(value.id);
						this.tabsData.set(value.id, value);
					}
				}

				//move previous tab to the end
				if (isForeground)
					this.activate(tab.id); // foreground
				else if (isBackground)
				{
					this.tabsData.delete(previousTab.id);
					this.tabsData.set(previousTab.id, previousTab);
					this.activate(previousTab.id); // background

				}

				actionButton.setIcon(tab);
				this.updateAll(tab.windowId);
			}, SETTINGS.tabsScrollFix * 50, "onCreated");

			debug.debug("created", this.win(tab.windowId), previousTab, tab);
		}, //onCreated()

		onRemoved: (tabId, removeInfo) =>
		{
			debug.debug("onRemoved", {tabId, removeInfo});
			this.noChange = true;
			this.tabsQuery({active: true, windowId: removeInfo.windowId}, tabs =>
			{
				const removedTab = this.remove({id: tabId, windowId: removeInfo.windowId});
				const currentTab = tabs[0];
				const last = this.last(removeInfo.windowId, true);

				debug.debug("onRemoved currentTab", tabId, currentTab?.id, last, removeInfo, removedTab);

				if (!currentTab /* last tab in window */ || last.id === tabs[0].id)
				{
					this.noChange = false;
					return;
				}

				this.noChange = true;
				const windowId = removedTab.windowId;

				let index = removedTab.index;
				let previousTab = this.last(windowId, true);

				debug.debug("remove", tabId, "prev", previousTab?.id, "cur", currentTab.id, previousTab && (previousTab.id !== tabId && currentTab.id === previousTab.id));
				//  if ((prevTab && prevTab.id != tabId) || !settings.afterClose)
				if (!SETTINGS.afterClose || (SETTINGS.afterClose === 1 && previousTab?.id !== tabId && currentTab.id === previousTab?.id))
				{
					this.noChange = false;
					return debug.debug("noChange", "exit remove", this.noChange);
				}

				previousTab = this.last(windowId, true);
				if (!previousTab)
					previousTab = this.last(windowId);

				if (!previousTab)
					return;

				debug.debug("removing", tabId, previousTab.id, currentTab.id, "removed ind ", index, "cur ind", currentTab.index);
				const result = _tabs =>
				{
					this.noChange = false;
					this.activate(_tabs[0].id)
						.catch(error => debug.error("onRemoved callback", error));
				};

				if (SETTINGS.afterClose === 1)
				{
					chrome.tabs.get(previousTab.id)
						.then(tab => result([tab]))
						.catch(error => debug.error("onRemoved afterClose", error)); //previous active
				}
				else
				{
					chrome.tabs.query({
						index: [
							index && --index || 0, // left
							index // right
						][SETTINGS.afterClose - 2],
						windowId: windowId
					})
						.then(result)
						.catch(error => debug.error("onRemoved query", error));
					debug.debug([
						(index && --index) || 0, // left
						index // right
					][SETTINGS.afterClose - 2], SETTINGS.afterClose - 2, (index && --index) || 0, index);
				}
				/*
		switch (settings.afterClose)
		{
			case 1: // last used tab
			chrome.tabs.update(tabsArray[0], {active: true});
			break;
			case 2: // left
			chrome.tabs.query({windowId: currentWindowId}, tabs =>
			{
				if (currentTabIndex > 0)
				currentTabIndex = currentTabIndex - 1;

				chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
			});
			break;
			case 3: // right
			chrome.tabs.query({windowId: currentWindowId}, tabs =>
			{
				if (currentTabIndex >= this.length)
				currentTabIndex = this.length - 1;

				chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
			});
			break;
			}
		*/
				this.updateAll(windowId);
				debug.debug("remove win", this.win(windowId));
			});
		}, //onRemoved()

		onAttached: (tabId, attachInfo) =>
		{
			debug.debug("onAttached", {tabId, attachInfo, data: CLONE(this.find({id: tabId, windowId: attachInfo.newWindowId}) || {})});
			this.updateAll(attachInfo.windowId);
			// this.updateData(this.find({id: tabId, windowId: attachInfo.newWindowId}), {id: tabId, windowId: attachInfo.newWindowId}, true);
			// this.save();
			debug.debug("onAttached after", CLONE(this.find({id: tabId, windowId: attachInfo.newWindowId}) || {}));
		}, //onAttached()

		onDetached: (tabId, detachInfo) =>
		{
			debug.debug("onDetached", {tabId, detachInfo, data: CLONE(this.find({id: tabId, windowId: detachInfo.oldWindowId}) || {})});
			this.updateAll(detachInfo.windowId);
			// this.updateData(this.find({id: tabId, windowId: detachInfo.oldWindowId}), {id: tabId, windowId: detachInfo.oldWindowId}, true);
			// this.save();
			debug.debug("onDetached after", CLONE(this.find({id: tabId, windowId: detachInfo.oldWindowId}) || {}));
		}, //onDetached()

		// onMoved: (tabId, moveInfo) =>
		// {
		// debug.debug("moved", tabId, moveInfo, clone(this.find(tabId)));
		//   this.updateData({id: tabId, windowId: moveInfo.windowId, index: moveInfo.toIndex});
		// debug.debug("moved end", this.find(tabId));
		// }, //onMoved()

		_onReplacedCallback: [],
		onReplaced: (addedTabId, removedTabId) =>
		{
			debug.debug("onReplaced", {addedTabId, removedTabId});
			chrome.tabs.get(addedTabId)
				.then(tab =>
				{
					let removedTab;
					// const tabs = [...this.tabsData.values()];
					for(const tabsData of this.tabsData)
					{
						const data = tabsData[1];
						if (data.id === removedTabId)
						{
							this.tabsData.delete(removedTabId);
							removedTab = data;
							data.id = tab.id;
						}
						this.tabsData.delete(data.id);
						this.tabsData.set(data.id, data);
					}
					this.updateData(tab, removedTab);
					this.add(tab, false, false);
					const callback = tabsHandler._onReplacedCallback;
					while(callback.length > 0)
						callback.shift()({tab, oldTab: removedTab || this.find({id: removedTabId})});

					return tab;
				})
				.catch(error => debug.error("onReplaced", error));
		}, //onReplaced()

		onUpdated: (tabId, changeInfo, origTab) =>
		{
			const origTabClone = CLONE(origTab);
			let tab = this.find(origTab);
			if (tab)
			{
				const tabUUID = tab.tabUUID;
				const windowUUID = tab.windowUUID;

				tab = this.updateData(tab, origTab);
				this.setUUID(tab);
				this.setWinUUID(tab);
				if (tabUUID !== tab.tabUUID || windowUUID !== tab.windowUUID)
					this.save();
			}
			else
				tab = origTab;

			// if (changeInfo.discarded === false && !onRemoveTab.noUnload)
			// 	onRemoveTab.unload = tabId;

			// delete onRemoveTab.noUnload;
			// debug.debug("onUpdated", tabId, {onRemoveTab: CLONE(onRemoveTab), changeInfo, changeInfoCloned: CLONE(changeInfo), tab: CLONE(tab), origTabClone});
			if (changeInfo.status === "loading")
			{
				actionButton.setIcon(tab);
			}

		//   debug.debug("onUpdated", {tabId, changeInfoStatus: changeInfo.status, tabStatus: tab.status, changeInfo, tab: JSON.parse(JSON.stringify(tab)), tabStored: this.find(tabId)});
		// //debug.debug("onUpdated", tabId, changeInfo, changeInfo.status === "loading", clone(tab));
		//   this.updateData(Object.assign(changeInfo, {id: tabId, windowId: tab.windowId}));
		// debug.debug("onUpdated end", this.find(tabId,tab.windowId));
		}, //onUpdated()

		onMoved: (tabId, changeInfo, tab) =>
		{
			tab = tab || {id: tabId, windowId: changeInfo.windowId, index: changeInfo.toIndex};
			debug.debug("onMoved", {tabId, changeInfo, tab: CLONE(tab), found: CLONE(this.find(tab))});
			this.updateAll(changeInfo.windowId);
		},

	};//tabsEventHandler

	/**
	 * Retrieves information about a tab with the given ID.
	 * @param {number} id - The ID of the tab to retrieve information for.
	 * @param {function} callback - The callback function to be called with the tab information.
	 * @see: https://stackoverflow.com/questions/67887896
	 */
	tabsGet (id, callback)
	{
		const callback_ = tabs => (chrome.runtime.lastError ? setTimeout(() => chrome.tabs.get(id, callback_)) : callback(tabs));
		chrome.tabs.get(id)
			.then(callback_)
			.catch(error => debug.error("tabsGet", error));
	}

	/**
	 * Queries the Chrome tabs based on the given query object and invokes the callback function with the result.
	 *
	 * @param {Object} query - The query object used to filter the tabs.
	 * @param {Function} callback - The callback function to be invoked with the tabs result.
	 * @returns {Promise} A promise that resolves with the tabs result.
	 */
	tabsQuery (query, callback)
	{
		const callback_ = tabs => ((chrome.runtime.lastError) ? setTimeout(() => chrome.tabs.query(query, callback_)) : callback(tabs)); //https://stackoverflow.com/questions/67887896
		return chrome.tabs.query(query)
			.then(callback_)
			.catch(error => debug.error("tabsQuery", error));
	}

	/**
	 * Unloads tabs by discarding them.
	 * @param {Array} tabs - The array of tabs to unload.
	 * @param {string} [type=ACTION_UNLOAD_TAB] - The type of action to perform on the tabs.
	 */
	unloadTabs (tabs, type = ACTION_UNLOAD_TAB)
	{
		for(let i = 0; i < tabs.length; i++)
		{
			const tab = tabs[i];
			if (!tab.discarded)
			{
				const result = () => chrome.tabs.discard(tab.id).catch(error => debug.error("unloadTabs", error));
				debug.debug("unloadTab", {id: tab.id, type, tab});
				if (type === ACTION_UNLOAD_TAB || type === ACTION_UNLOAD_WINDOW)
				{
					const previousTab = this.last(tab.windowId, true, [tab.id]);
					if (!previousTab)
						continue;

					this.activate(previousTab.id)
						.then(result)
						.catch(error => debug.error("unloadTabs", error));
				}
				else
				{
					result();
				}
			}
		}
	}

} // class TabsList
