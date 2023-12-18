/* eslint indent: ["error","tab",{"SwitchCase": 1,"ignoreComments": true, "outerIIFEBody": 0}] */

(() =>
{
const prefs = {};
let inited = false;
let contextMenuOption = null;
let elMenu = null;
let elCopy = null;
let total = 0;
let elTemplateOption = null;
let elTemplateMenu = null;
let elCopyTitle = null;
let windowTitleLength = 0;
let dateLength = 0;

chrome.sessions.onChanged.addListener(() => setTimeout(init, 100));

const messenger = () =>
{
	const tab = chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]);
	debug.debug("popup messenger");
	const port = chrome.runtime.connect(null, { name: "actionPopup" });
	port.onMessage.addListener(message =>
	{
		debug.debug("popup onMessage", message);
		switch (message.type)
		{
			case "prefs": {
				for (const i in message.data)
				{
					if (!(i in prefs))
						prefs[i] = {};

					Object.assign(prefs[i], message.data[i]);
				}
				init();
				break;
			}
			case "prefChanged": {
				prefs[message.name].value = message.newValue;
				init(message.name);
				break;
			}
		}
	});
	port.onDisconnect.addListener(messenger);
	port.postMessage({ type: "prefs" });
	tab.then(_tab => port.postMessage({ type: "tab", data: _tab }))
		.catch(error => debug.error("popup messenger", error));
};

messenger();

const sTab = chrome.i18n.getMessage("tab");
const sTabs = chrome.i18n.getMessage("tabs");
const sWindow = chrome.i18n.getMessage("window");
const sSecond = chrome.i18n.getMessage("second");
const sMinute = chrome.i18n.getMessage("minute");
const sHour = chrome.i18n.getMessage("hour");
const sDay = chrome.i18n.getMessage("day");
const sMonth = chrome.i18n.getMessage("month");
const sYear = chrome.i18n.getMessage("year");

const genTemplate = (elContainer, sessions, isWindow) =>
{
	let n = 1;
	if (sessions.length === 0)
	{
		document.body.classList.add("empty");
		document.getElementById("empty").textContent = chrome.i18n.getMessage("noHistory");
		window.addEventListener("click", window.close);
	}
	for (let i = 0; i < sessions.length; i++)
	{
		elContainer.append(getOption({ sessionItem: sessions[i], isWindow, n }));
		n++;
	}
};

const relativeDate = date =>
{
	const diff = Math.round((Date.now() - new Date(date)) / 1000);

	const minute = 60;
	const hour = minute * 60;
	const day = hour * 24;
	const month = day * 30;
	const year = month * 12;
	if (diff < minute)
	{
		return diff + sSecond;
	}
	else if (diff < hour)
	{
		return Math.floor(diff / minute) + sMinute;
	}
	else if (diff < day)
	{
		return Math.floor(diff / hour) + sHour;
	}
	else if (diff < month)
	{
		return Math.floor(diff / day) + sDay;
	}
	else if (diff < year)
	{
		return Math.floor(diff / month) + sMonth;
	}
	return Math.floor(diff / year) + sYear;
};

const getOption = ({ sessionItem, isWindow, n }) =>
{
	let _total = 0;
	let session = sessionItem.window;
	let option;
	let favicon = "";
	let tabsCount = 0;
	let title = "";
	const index = (isWindow === undefined ? "" : isWindow + ".") + n;
	const sDate = relativeDate(sessionItem.lastModified * 1000);
	if (session)
	{
		session = sessionItem.window;
		option = elTemplateMenu.cloneNode(true);
		_total = total++;
		genTemplate(option.querySelector(".container"), session.tabs.map(tab =>
		{
			return {lastModified: sessionItem.lastModified, tab};
		}), n);
		total = _total;
		tabsCount = session.tabs.length;
		_total = tabsCount;
		option.querySelector(".title").dataset.num = index;
		const elMenuTitle = option.querySelector(".menuTitle .title");
		const windowTitle = `${sWindow} (${_total} ${_total > 1 ? sTabs : sTab})`;
		if (windowTitleLength < windowTitle.length + sDate.length)
			windowTitleLength = windowTitle.length + sDate.length;

		if (dateLength < sDate.length)
			dateLength = sDate.length;

		elMenuTitle.textContent = windowTitle;
		if (prefs.expandWindow.value)
			option.classList.add("open");

		option.querySelector(".menuTitle .date").textContent = sDate;
	}
	else
	{
		option = elTemplateOption.cloneNode(true);
		session = sessionItem.tab || sessionItem;
		favicon = session.favIconUrl;
		title = session.title;
		const url = session.url;
		const elUrl = option.querySelector(".url");
		elUrl.textContent = url;
		elUrl.title = url;
		option.title = title;
		option.dataset.num = index;
	}
	// option.querySelector(".num").textContent = index; // (_n ? _n + "|" : "") + n;
	option.querySelector(".favicon").src = favicon;
	for (const s in session)
		option.dataset[s] = Array.isArray(session[s]) ? session[s].length : session[s];

	const elTitle = option.querySelector(".title");
	elTitle.textContent = title;
	const elDate = option.querySelector(".date");
	elDate.textContent = sDate;
	const date = new Date(sessionItem.lastModified * 1000).toString();
	elDate.title = date.split(" ").slice(0, 5).join(" ");//.toLocaleString("sv");

	option.addEventListener("click", onClick({ option, isMenu: !!sessionItem.window, elTitle, session }));

	if (_total)
		total += _total;

	total++;
	return option;
};

const onClick = ({ option, isMenu, elTitle, session }) => evt =>
{
	if (contextMenuOption)
		return;

	contextMenuClose(evt);
	evt.stopPropagation();
	// const sub = evt.target.classList.contains("sub") ? evt.target : (evt.target.parentNode.classList.contains("sub") ? evt.target.parentNode : null);
	if (evt.target.classList.contains("sub") && evt.target || (evt.target.parentNode.classList.contains("sub") ? evt.target.parentNode : null))
		return option.classList.toggle("open");

	const elHover = option.querySelector(":hover");
	if (!isMenu || (isMenu && (elHover === elTitle || elHover.closest(".title") === elTitle || elHover.matches(".date"))))
	{
		debug.debug("restore", session.sessionId);
		chrome.sessions.restore(session.sessionId);
		window.close();
	}
};

const contextMenuClose = evt =>
{
	if (evt)
		evt.preventDefault();

	if (!contextMenuOption)
		return;

	debug.debug(evt, contextMenuOption);

	debug.debug(evt && evt.target);
	debug.debug(elCopy);
	if (evt)
	{
		let close = false;
		if (evt.target === elCopy)
		{
			debug.debug(contextMenuOption.dataset.url);
			navigator.clipboard.writeText(contextMenuOption.dataset.url);
			close = true;
			// return;
		}
		else if (evt.target === elCopyTitle)
		{
			debug.debug(contextMenuOption.dataset.title);
			navigator.clipboard.writeText(contextMenuOption.dataset.title);
			close = true;
			// return;
		}
		if (close)
		{
			evt.preventDefault();
		}

	}
	document.body.removeAttribute("contextMenu");
	contextMenuOption.classList.remove("highlight");
	contextMenuOption = null;
};

document.title = chrome.i18n.getMessage("contextMenu_closedTabs");
const init = pref =>
{
	document.body.classList.toggle("no-date", !prefs.showDate.value);
	if (pref && pref !== "expandWindow")
		return;

	elMenu = document.getElementById("list");
	elCopy = document.getElementById("copy");
	elCopyTitle = document.getElementById("copyTitle");

	elMenu.innerHTML = "";
	chrome.sessions.getRecentlyClosed(sessions =>
	{
		elTemplateOption = document.querySelector("#templates > .option");
		elTemplateMenu = document.querySelector("#templates > .menu");

		total = 0;
		genTemplate(elMenu, sessions);
		document.documentElement.style.setProperty("--window-title-length", windowTitleLength + "ch");
		document.documentElement.style.setProperty("--date-length", dateLength + "ch");

	});

	const elContextMenu = document.getElementById("contextMenu");
	const normalizePosition = (mouseX, mouseY) =>
	{
		const scope = elMenu;
		// ? compute what is the mouse position relative to the container element (scope)
		const {
			left: scopeOffsetX,
			top: scopeOffsetY,
		} = scope.getBoundingClientRect();

		const scopeX = mouseX - scopeOffsetX;
		const scopeY = mouseY - scopeOffsetY;

		// ? check if the element will go out of bounds
		const outOfBoundsOnX =
			scopeX + elContextMenu.clientWidth > scope.clientWidth;

		const outOfBoundsOnY =
			scopeY + elContextMenu.clientHeight > scope.clientHeight;

		let normalizedX = mouseX;
		let normalizedY = mouseY;

		// ? normalize on X
		if (outOfBoundsOnX)
		{
			normalizedX =
				scopeOffsetX + scope.clientWidth - elContextMenu.clientWidth;
		}

		// ? normalize on Y
		if (outOfBoundsOnY)
		{
			normalizedY =
				scopeOffsetY + scope.clientHeight - elContextMenu.clientHeight;
		}
		return { x: normalizedX, y: normalizedY };
	};
	if (inited)
		return;

	elCopy.textContent = chrome.i18n.getMessage("contextMenu_copy");
	elCopyTitle.textContent = chrome.i18n.getMessage("contextMenu_copyTitle");

	document.documentElement.addEventListener("contextmenu", evt =>
	{
		debug.debug(evt);
		if (evt.target.closest("#contextMenu"))
			return contextMenuClose(evt);

		evt.preventDefault();

		if (contextMenuOption)
			contextMenuClose();

		contextMenuOption = evt.target.closest(".option:not(.menu)");
		if (!contextMenuOption)
			return contextMenuClose();

		debug.debug(contextMenuOption);
		debug.debug(evt.target.getBoundingClientRect());
		document.body.setAttribute("contextMenu", contextMenuOption.dataset.sessionId);
		const pos = normalizePosition(evt.clientX, evt.clientY);
		elContextMenu.style.left = pos.x + "px";
		elContextMenu.style.top = pos.y + "px";
		debug.debug(pos, evt.offsetX, evt.offsetY);
		contextMenuOption.classList.add("highlight");
		elContextMenu.focus();
	});

	document.documentElement.addEventListener("click", contextMenuClose);
	document.documentElement.addEventListener("keydown", contextMenuClose);
	document.addEventListener("scroll", contextMenuClose);
	elContextMenu.addEventListener("blur", evt =>
	{
		debug.debug("blur", evt);
	});
	inited = true;
}; //init()

window.addEventListener("DOMContentLoaded", () =>
{
	document.documentElement.classList.remove("notLoaded");
}, { once: true });
})();
