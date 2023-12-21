/* eslint indent: ["error","tab",{"SwitchCase": 1,"ignoreComments": true, "outerIIFEBody": 0}] */

(() =>
{
const prefs = {};
let inited = false;
let contextMenuOption = null;
let elMenu = null;
let elCopy = null;
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

const genTemplate = ({elContainer, sessions, windowIndex, indexLength = 0}) =>
{
	if (sessions.length === 0)
	{
		document.body.classList.add("empty");
		document.getElementById("empty").textContent = chrome.i18n.getMessage("noHistory");
		window.addEventListener("click", window.close);
	}
	for (let index = 0; index < sessions.length; index++)
	{
		getOption({ elContainer, sessions, windowIndex, index, indexLength});
	}
};

const getOption = ({ elContainer, sessions, windowIndex, index, indexLength}) =>
{
	const sessionItem = sessions[index];
	let session = sessionItem.window;
	let option;
	let favicon = "";
	let title = "";
	const sIndex = (windowIndex === undefined ? "" : windowIndex + ".") + ++index;
	if (indexLength < sIndex.length)
		indexLength = sIndex.length;

	const sDate = relativeDate(sessionItem.lastModified * 1000);
	if (session)
	{
		option = elTemplateMenu.cloneNode(true);
		genTemplate({elContainer: option.querySelector(".container"), sessions: session.tabs.map(tab =>
		{
			return {lastModified: sessionItem.lastModified, tab};
		}), windowIndex: index, indexLength: 0});
		title = `${sWindow} (${session.tabs.length} ${session.tabs.length > 1 ? sTabs : sTab})`;
		if (windowTitleLength < title.length)
			windowTitleLength = title.length;

		if (prefs.expandWindow.value)
			option.classList.add("open");

	}
	else
	{
		option = elTemplateOption.cloneNode(true);
		session = sessionItem.tab || sessionItem;
		const url = session.url;
		favicon = session.favIconUrl || prefs.favicons.value[url] || "";
		title = session.title;
		const elUrl = option.querySelector(".url");
		elUrl.textContent = url;
		// elUrl.title = url;
		option.title = title + "\n" + url;
		option.querySelector(".favicon").src = favicon;
	}
	// for (const s in session)
	// 	option.dataset[s] = Array.isArray(session[s]) ? session[s].length : session[s];

	const elIndex = option.querySelector(".index");
	elIndex.textContent = sIndex;

	const elTitle = option.querySelector(".title");
	elTitle.textContent = title;

	const elDate = option.querySelector(":scope > .date");
	const date = new Date(sessionItem.lastModified * 1000).toString();
	elDate.title = date.split(" ").slice(0, 5).join(" ");//.toLocaleString("sv");
	if (!windowIndex)
	{
		elDate.textContent = sDate;
		aDates.push(elDate);
	}

	option.addEventListener("click", onClick({ option, session }));
	elContainer.append(option);
	elContainer.style.setProperty("--index-length" + (windowIndex ? "-tabs" : ""), indexLength + (windowIndex ? 0 : 1) + "ch");
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

		genTemplate({elContainer: elMenu, sessions});
		document.documentElement.style.setProperty("--window-title-length", windowTitleLength + "ch");

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
