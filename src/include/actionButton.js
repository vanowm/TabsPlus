
/**
 * Toolbar button action handler.
 * @param {Object} tab - The tab object.
 * @param {string} iconAction - The action to be performed.
 */
const actionButton = (tab, iconAction) =>
{
	if (iconAction === undefined)
		iconAction = SETTINGS.iconAction;

	const found = TABS.find(tab) || tab;
	debug.debug("actionButton", iconAction, tab.skip, found.skip, tab === found, tab, found);
	switch (iconAction)
	{
		case ACTION_UNDO: {
			chrome.sessions.getRecentlyClosed(sessions =>
			{
				debug.debug(sessions);
				const sessionId = sessions[0]?.tab?.sessionId || sessions[0]?.window?.tabs[0]?.sessionId || null;
				debug.debug(sessionId);
				chrome.sessions.restore(sessionId);
			});
			break;
		}

		case ACTION_SKIP: {
			found.skip = !found.skip;
			TABS.save();
			actionButton.setIcon(found);
			CONTEXTMENU.setContext(found);
			break;
		}

		// case ACTION_FREEZE:
		//   found.freeze = !found.freeze;
		//   setIcon(found);
		//   break;

		// case ACTION_PROTECT:
		//   found.protect = !found.protect;
		//   setIcon(found);
		//   break;

		case ACTION_LIST: {
			const winOptions = {
				url: "ui/actionPopup.html",
				type: "panel",
				focused: true,
				width: 335,
				height: 640
			};

			actionButton.setIcon(tab);
		//get current window screen location
			chrome.windows.getCurrent(null, currentWin =>
			{
				if (currentWin)
				{
					winOptions.left = currentWin.left + Math.round((currentWin.width - winOptions.width) / 2);
					winOptions.top = currentWin.top + Math.round((currentWin.height - winOptions.height) / 2);
				}

				chrome.windows.create(winOptions, win =>
				{
					debug.debug(win);
				});
			});
			break;
		}

		case ACTION_UNLOAD_TAB: {
			chrome.tabs.query({currentWindow: true, active: true})
				.then(tabs => TABS.unloadTabs(tabs, ACTION_UNLOAD_TAB))
				.catch(error => debug.error("actionButton", ACTION_UNLOAD_TAB, error));
			break;
		}

		case ACTION_UNLOAD_WINDOW: {
			chrome.tabs.query({currentWindow: true, active: false})
				.then(tabs => TABS.unloadTabs(tabs, ACTION_UNLOAD_WINDOW))
				.catch(error => debug.error("actionButton", ACTION_UNLOAD_WINDOW, error));
			break;
		}

		case ACTION_UNLOAD_ALL: {
			chrome.tabs.query({active: false})
				.then(tabs => TABS.unloadTabs(tabs, ACTION_UNLOAD_ALL))
				.catch(error => debug.error("actionButton", ACTION_UNLOAD_ALL, error));
			break;
		}
	}//switch
};

	/**
	 * Sets the icon, badge, title, and popup for a given tab.
	 *
	 * @param {Object} tab - The tab object.
	 * @returns {void}
	 */
actionButton.setIcon = tab =>
{
	if (!tab)
		return debug.trace("actionButtonSetIcon error tab", tab);

	let title = APP.name;
	let popup = "";
	const open = ~~MESSENGER.tabs.has(tab.id);
	const action = SETTINGS.iconAction ? "enable" : "disable";
	const skipped = TABS.find(tab) || tab;
	const property = ACTIONPROPS[SETTINGS.iconAction];
	const color = ["#8AB4F8", "#F88AAF", "#74839C", "#9B7783"][~~skipped[ACTIONPROPS[ACTION_SKIP]] + open * 2];
	let badge = skipped[ACTIONPROPS[ACTION_SKIP]] ? "☐" : "🗹";

	if (SETTINGS.iconAction === ACTION_LIST)
	{
		popup = "ui/actionPopup.html";
		badge += open ? " ▲" : " ▼";
	}
	else if (SETTINGS.iconAction)
	{
		badge = badge + "" + i18n("iconAction_" + SETTINGS.iconAction + "_badge").padStart(2, " ");
	}

	debug.trace("actionButtonSetIcon", {id: tab.id, badge, iconAction: SETTINGS.iconAction, prop: property, open, tab, skipped, tabConnect: MESSENGER.tabs});
	if (badge.length < 3)
		badge = "  " + badge + "  ";

	if (SETTINGS.iconAction === ACTION_SKIP)
	{
		title += "\n" + i18n("iconAction_" + ACTION_SKIP + "_" + (skipped.skip ? "N" : "Y"));
	}
	else if (SETTINGS.iconAction)
	{
		title += "\n" + i18n("iconAction_" + SETTINGS.iconAction);
	}
	chrome.action[action](tab.id).catch(Void);
	if (color)
		chrome.action.setBadgeBackgroundColor({color, tabId: tab.id}).catch(Void);

	chrome.action.setBadgeText({text: badge, tabId: tab.id}).catch(Void);
	chrome.action.setPopup({tabId: tab.id, popup: popup}).catch(Void);
	chrome.action.setTitle({tabId: tab.id, title: title}).catch(Void);
	debug.trace("actionButtonSetIcon", {action, title, badge, popup});
};
