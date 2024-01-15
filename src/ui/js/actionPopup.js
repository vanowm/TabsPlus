/* eslint indent: ["error","tab",{"SwitchCase": 1,"ignoreComments": true, "outerIIFEBody": 0}] */

(() =>
{
const settings = {};
let inited = false;
let contextMenuOption = null;
let elMenu = null;
let elCopyUrl = null;
let elTemplateOption = null;
let elTemplateMenu = null;
let elCopyTitle = null;
let windowTitleLength = 0;
const openWindows = {};

template({app:APP});

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
			case "settings": /* this start init */
			{
				for (const i in message.data)
					settings[i] = message.data[i];

				if (!reconnected)
					init();

				break;
			}
			case "settingChanged":
			{
				if (!settings[message.name] || settings[message.name].internal)
					break;

				settings[message.name].value = message.newValue;
				init(message.name);
				break;
			}
		}
	});
	port.onDisconnect.addListener(messenger); //this will allow us automatically reconnect
	port.postMessage({ type: "settings" }); //get settings and start initialization
	tab.then(_tab => port.postMessage({ type: "tab", data: _tab }))
		.catch(error => debug.error("popup messenger", error));
};

messenger();

const aDates = [];

const relativeDate = date =>
{
	if (!date)
		return "n/a";

	const diff = Math.round((Date.now() - new Date(date)) / 1000);

	const minute = 60;
	const hour = minute * 60;
	const day = hour * 24;
	const month = day * 30;
	const year = month * 12;
	if (diff < minute)
	{
		return diff + i18n.second;
	}
	else if (diff < hour)
	{
		return Math.floor(diff / minute) + i18n.minute;
	}
	else if (diff < day)
	{
		return Math.floor(diff / hour) + i18n.hour;
	}
	else if (diff < month)
	{
		return Math.floor(diff / day) + i18n.day;
	}
	else if (diff < year)
	{
		return Math.floor(diff / month) + i18n.month;
	}
	return Math.floor(diff / year) + i18n.year;
};

const genTemplate = ({elContainer, sessions, windowIndex, indexLength = 0}) =>
{
	const isEmpty = sessions.length === 0;
	document.body.classList.toggle("empty", isEmpty);
	for (let index = 0; index < sessions.length; index++)
	{
		getOption({ elContainer, sessions, windowIndex, index, indexLength});
	}
};

const faviconRegex = new RegExp("^chrome-extension://(?!" + chrome.runtime.id + "/)", "");

const getOption = ({ elContainer, sessions, windowIndex, index, indexLength}) =>
{
	const sessionItem = sessions[index];
	let session = sessionItem.window;
	let elOption;
	let favicon = "";
	let title = "";
	const sIndex = (windowIndex === undefined ? "" : windowIndex + ".") + ++index;
	if (indexLength < sIndex.length)
		indexLength = sIndex.length;

	const sDate = relativeDate(sessionItem.lastModified * 1000);
	if (session)
	{
		elOption = elTemplateMenu.cloneNode(true);
		genTemplate({elContainer: elOption.querySelector(".container"), sessions: session.tabs.map(tab =>
		{
			return {lastModified: sessionItem.lastModified, tab};
		}), windowIndex: index, indexLength: 0});
		title = `${i18n.window} (${session.tabs.length} ${session.tabs.length > 1 ? i18n.tabs : i18n.tab})`;
		if (windowTitleLength < title.length)
			windowTitleLength = title.length;

		if (settings.expandWindow.value)
			elOption.classList.add("open");

		elOption.classList.toggle("open", !!openWindows[session.sessionId]);
	}
	else
	{
		elOption = elTemplateOption.cloneNode(true);
		session = sessionItem.tab || sessionItem;
		const url = session.url;
		// console.trace(session);
		favicon = session.favIconUrl || settings.favicons.value[url] || settings.favicons.value[getHostname(url)] || "";
		if (faviconRegex.test(favicon))
			favicon = "";

		// favicon = faviconURL(url);

		title = session.title;
		const elUrl = elOption.querySelector(".url");
		elUrl.textContent = url;
		// elUrl.title = url;
		elOption.title = title + "\n" + url;
		const elFavicon = elOption.querySelector(".favicon");
		if (favicon)
			elFavicon.style.setProperty("--url", `url(${CSS.escape(favicon)})`);
		else
			elFavicon.style.removeProperty("--url");
		// const image = new Image();
		// image.addEventListener("error", () => (chrome.runtime.lastError, elFavicon.style.removeProperty("--url")));
		// image.addEventListener("load", evt => elFavicon.style.setProperty("--url", `url(${CSS.escape(evt.target.src)})`));
		// image.src = favicon;

	}
	// for (const s in session)
	// 	option.dataset[s] = Array.isArray(session[s]) ? session[s].length : session[s];

	const elIndex = elOption.querySelector(".index");
	elIndex.textContent = sIndex;

	const elTitle = elOption.querySelector(".title");
	elTitle.textContent = title;

	const elDate = elOption.querySelector(":scope > .date");
	let sDateTitle = "";
	if (sessionItem.lastModified)
	{
		const date = new Date(sessionItem.lastModified * 1000).toString();
		sDateTitle = date.split(" ").slice(0, 5).join(" ");//.toLocaleString("sv");
	}
	elDate.title = sDateTitle;
	if (!windowIndex)
	{
		elDate.textContent = sDate;
		elDate.dataset.date = sDate;
		if (sessionItem.lastModified)
			aDates.push(elDate);
	}

	elOption.addEventListener("click", onClick(elOption));
	elOption.dataset.id = session.sessionId;
	elContainer.append(elOption);
	if (windowIndex)
		elContainer.style.setProperty("--index-length-tabs", indexLength + "ch");
	else
		elContainer.style.setProperty("--index-length", indexLength + 1 + "ch");

	return elOption;
};

const onClick = elOption => evt =>
{
	if (contextMenuOption)
		return;

	contextMenuClose(evt);
	evt.stopPropagation();
	const id = elOption.dataset.id;
	if (evt.target.classList.contains("sub"))
	{
		const isOpen = !elOption.classList.contains("open");
		openWindows[id] = isOpen;
		if (evt.ctrlKey)
		{
			const nlMenus = elOption.parentNode.querySelectorAll(".menu");
			for(let i = 0; i < nlMenus.length; i++)
			{
				openWindows[nlMenus[i].dataset.id] = isOpen;
				nlMenus[i].classList.toggle("open", isOpen);
			}

		}
		return elOption.classList.toggle("open", isOpen);
	}

	debug.debug("restore", id);
	chrome.sessions.restore(id);
	window.close();
};

const faviconURL = u =>
{
	const url = new URL(chrome.runtime.getURL("/_favicon/"));
	url.searchParams.set("pageUrl", u);
	url.searchParams.set("size", "32");
	return url.toString();
};

const contextMenuClose = evt =>
{
	if (evt)
		evt.preventDefault();

	if (!contextMenuOption)
		return;

	debug.debug(evt, contextMenuOption);
	if (evt)
	{
		let text;
		switch(evt.target)
		{
			case elCopyUrl:
			{
				text = contextMenuOption.querySelector(".url").textContent;
				break;
			}
			case elCopyTitle:
			{
				text = contextMenuOption.querySelector(".title").textContent;
				break;
			}
		}
		if (text !== undefined)
		{
			navigator.clipboard.writeText(text);
			debug.trace(text);
			evt.preventDefault();
		}

	}
	document.body.removeAttribute("contextMenu");
	contextMenuOption.classList.remove("highlight");
	contextMenuOption = null;
};

// document.title = _.contextMenu_closedTabs;
let lastTimestamp;

const dateLoop = timestamp =>
{
	if (timestamp - lastTimestamp > 1000)
	{
		lastTimestamp = timestamp;
		if (settings.showDate.value)
		{
			for(let i = 0; i < aDates.length; i++)
			{
				const sDate = relativeDate(aDates[i].title);
				aDates[i].dataset.date = sDate;
				aDates[i].textContent = sDate;
			}
		}
	}
	requestAnimationFrame(dateLoop);
};

const init = setting =>
{
	debug.trace("actionPopup init", setting);
	document.body.classList.toggle("no-date", !settings.showDate.value);
	document.body.classList.toggle("no-icon", !settings.showIcon.value);
	document.body.classList.toggle("no-title", !settings.showTitle.value);
	document.body.classList.toggle("no-url", !settings.showUrl.value);
	lastTimestamp = 0;
	if (setting)
	{
		if (setting === "expandWindow")
		{
			const nlMenus = document.querySelectorAll(".menu");
			for (let i = 0; i < nlMenus.length; i++)
			{
				if (!(nlMenus[i].dataset.id in openWindows))
					nlMenus[i].classList.toggle("open", settings.expandWindow.value);
			}
		}
		return;
	}
	contextMenuClose();
	elMenu = document.getElementById("list");
	elCopyUrl = document.getElementById("copyUrl");
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

	elCopyUrl.textContent = i18n.contextMenu_copy;
	elCopyTitle.textContent = i18n.contextMenu_copyTitle;

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

	dateLoop();
	inited = true;
}; //init()

window.addEventListener("DOMContentLoaded", () =>
{
	document.documentElement.classList.remove("loading");
	const elEmpty = document.getElementById("empty");
	elEmpty.addEventListener("click", window.close.bind(window));
}, { once: true });
})();
