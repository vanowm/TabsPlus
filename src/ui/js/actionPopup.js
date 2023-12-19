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

chrome.sessions.onChanged.addListener(() => setTimeout(init, 100));

const messenger = reconnected =>
{
	const tab = chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]);
	debug.debug("popup messenger");
	const port = chrome.runtime.connect(null, { name: "actionPopup" });
	port.onMessage.addListener(message =>
	{
		debug.debug("popup onMessage", message);
		switch (message.type)
		{
			case "prefs": /* this start init */
			{
				for (const i in message.data)
				{
					if (!(i in prefs))
						prefs[i] = {};

					Object.assign(prefs[i], message.data[i]);
				}
				if (!reconnected)
					init();

				break;
			}
			case "prefChanged":
			{
				prefs[message.name].value = message.newValue;
				init(message.name);
				break;
			}
		}
	});
	port.onDisconnect.addListener(messenger); //this will allow us automatically reconnect
	port.postMessage({ type: "prefs" }); //get prefs and start initialization
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
const aDates = [];

const genTemplate = ({elContainer, sessions, isWindow}) =>
{
	if (sessions.length === 0)
	{
		document.body.classList.add("empty");
		document.getElementById("empty").textContent = chrome.i18n.getMessage("noHistory");
		window.addEventListener("click", window.close);
	}
	for (let i = 0; i < sessions.length; i++)
	{
		elContainer.append(getOption({ sessions, isWindow, i}));
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

const getOption = ({ sessions, isWindow, i}) =>
{
	const sessionItem = sessions[i];
	let _total = 0;
	let session = sessionItem.window;
	let option;
	let favicon = "";
	let tabsCount = 0;
	let title = "";
	const index = (isWindow === undefined ? "" : isWindow + ".") + ++i;
	const sDate = relativeDate(sessionItem.lastModified * 1000);
	if (session)
	{
		option = elTemplateMenu.cloneNode(true);
		_total = total++;
		genTemplate({elContainer: option.querySelector(".container"), sessions: session.tabs.map(tab =>
		{
			return {lastModified: sessionItem.lastModified, tab};
		}), isWindow: i});
		total = _total;
		tabsCount = session.tabs.length;
		_total = tabsCount;
		title = `${sWindow} (${_total} ${_total > 1 ? sTabs : sTab})`;
		if (windowTitleLength < title.length)
			windowTitleLength = title.length;

		if (prefs.expandWindow.value)
			option.classList.add("open");

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
		// elUrl.title = url;
		option.title = title + "\n" + url;
		option.querySelector(".favicon").src = favicon;
	}
	for (const s in session)
		option.dataset[s] = Array.isArray(session[s]) ? session[s].length : session[s];

	const elIndex = option.querySelector(".index");
	elIndex.textContent = index;

	const elTitle = option.querySelector(".title");
	elTitle.textContent = title;

	if (!isWindow)
	{
		const elDate = option.querySelector(":scope > .date");
		elDate.textContent = sDate;
		const date = new Date(sessionItem.lastModified * 1000).toString();
		elDate.title = date.split(" ").slice(0, 5).join(" ");//.toLocaleString("sv");
		aDates.push(elDate);
	}

	option.addEventListener("click", onClick({ option, session }));

	if (_total)
		total += _total;

	total++;
	return option;
};

const onClick = ({ option, session }) => evt =>
{
	if (contextMenuOption)
		return;

	contextMenuClose(evt);
	evt.stopPropagation();
	if (evt.target.classList.contains("sub"))
		return option.classList.toggle("open");

	debug.debug("restore", session.sessionId);
	chrome.sessions.restore(session.sessionId);
	window.close();
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
let lastTimestamp;

const timeLoop = timestamp =>
{
	if (timestamp - lastTimestamp > 1000)
	{
		lastTimestamp = timestamp;
		if (prefs.showDate.value)
		{
			for(let i = 0; i < aDates.length; i++)
				aDates[i].textContent = relativeDate(aDates[i].title);
		}
	}
	requestAnimationFrame(timeLoop);
};

const init = pref =>
{
	document.body.classList.toggle("no-date", !prefs.showDate.value);
	document.body.classList.toggle("no-url", !prefs.showUrl.value);
	lastTimestamp = 0;
	if (pref)
	{
		if (pref === "expandWindow")
		{
			const nlMenus = document.querySelectorAll(".menu");
			for (let i = 0; i < nlMenus.length; i++)
				nlMenus[i].classList.toggle("open", prefs.expandWindow.value);
		}
		return;
	}
	elMenu = document.getElementById("list");
	elCopy = document.getElementById("copy");
	elCopyTitle = document.getElementById("copyTitle");

	elMenu.innerHTML = "";
	chrome.sessions.getRecentlyClosed(sessions =>
	{
		elTemplateOption = document.querySelector("#templates .option");
		elTemplateMenu = document.querySelector("#templates .menu");

		total = 0;
		genTemplate({elContainer: elMenu, sessions});
		document.documentElement.style.setProperty("--window-title-length", windowTitleLength + "ch");
		document.documentElement.style.setProperty("--total", total);

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

	timeLoop();
	inited = true;
}; //init()

window.addEventListener("DOMContentLoaded", () =>
{
	document.documentElement.classList.remove("notLoaded");
}, { once: true });
})();
