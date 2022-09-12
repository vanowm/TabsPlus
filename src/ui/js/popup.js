let prefs = {},
    inited = false;

function messenger()
{
  const tab = chrome.tabs.query({active: true, currentWindow: true}).then(tabs => tabs[0]);
  debug.debug("popup messenger");
  const port = chrome.runtime.connect(null, {name: "actionPopup"});
  port.onMessage.addListener((message, _port) =>
  {
    debug.debug("popup onMessage", message);
    switch(message.type)
    {
      case "prefs":
        for(let i in message.data)
        {
          if (!(i in prefs))
            prefs[i] = {};

          Object.assign(prefs[i], message.data[i]);
        }
        init();
        break;
      case "prefChanged":
        prefs[message.name].value = message.newValue;
        init(message.name);
        break;
    }
  });
  port.onDisconnect.addListener(messenger);
  port.postMessage({type: "prefs"});
  tab.then(tab => port.postMessage({type: "tab", data: tab}));
}
messenger();

chrome.sessions.onChanged.addListener(() => setTimeout(init, 100));

function init (pref)
{
  if (pref && pref != "expandWindow")
    return;

  const elMenu = document.getElementById("list"),
        elCopy = document.getElementById("copy");
        elCopyTitle = document.getElementById("copyTitle");

  let contextMenuOption = null;

  elMenu.innerHTML = "";
  chrome.sessions.getRecentlyClosed(sessions => 
  {
    const elTemplateOption = document.querySelector("#templates > .option"),
          elTemplateMenu = document.querySelector("#templates > .menu");

    let total = 1;
    genTemplate(elMenu, sessions);
    function genTemplate(elContainer, sessions, _n)
    {
      let n = 1;
      for(let i = 0, isMenu, session, option, el, elTitle, num, favicon, title, url; i < sessions.length; i++)
      {
  debug.debug(i, sessions[i]);
        let _t = 0;
        if (sessions[i].window)
        {
          session = sessions[i].window;
          option = elTemplateMenu.cloneNode(true);
          _t = total;
          total++;
          genTemplate(option.querySelector(".container"), session.tabs, n);
          total = _t;
          _t = session.tabs.length;
          title = "Window (" + (session.tabs.length) + ")";
          url = "";
          favicon = "";
          isMenu = true;
          if (prefs.expandWindow.value)
            option.classList.add("open");
        }
        else
        {
          option = elTemplateOption.cloneNode(true);
          session = sessions[i].tab || sessions[i];
          favicon = session.favIconUrl;
          title = session.title;
          url = session.url;
          isMenu = false;
        }
        option.querySelector(".num").textContent = (_n !== undefined ? _n + "." : "") + n; // (_n ? _n + "|" : "") + n;
        option.querySelector(".favicon").src = favicon;
        for(let s in session)
          option.dataset[s] = session[s] instanceof Array ? session[s].length : session[s];

        elTitle = option.querySelector(".title");
        elTitle.textContent = title;
        if (!sessions[i].window)
          option.title = title;

        el = option.querySelector(".url");
        el.textContent = url;
        el.title = url;

        elContainer.appendChild(option);

        option.addEventListener("click", e =>
        {
          if (contextMenuOption)
            return;

          contextMenuClose(e);
          e.stopPropagation();
          const sub = e.target.classList.contains("sub") ? e.target : e.target.parentNode.classList.contains("sub") ? e.target.parentNode : null;
          if (sub)
            return option.classList.toggle("open");

          if (!isMenu || (isMenu && option.querySelector(":hover") === elTitle))
          {
  debug.debug("restore", session.sessionId);
            chrome.sessions.restore(session.sessionId);
            window.close();
          }
        });
        n++;
        if (_t)
          total += _t;

        total++;
      }
    }
  });

  const elContextMenu = document.getElementById("contextMenu");
  const normalizePosition = (mouseX, mouseY) => {
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
    if (outOfBoundsOnX) {
      normalizedX =
        scopeOffsetX + scope.clientWidth - elContextMenu.clientWidth;
    }

    // ? normalize on Y
    if (outOfBoundsOnY) {
      normalizedY =
        scopeOffsetY + scope.clientHeight - elContextMenu.clientHeight;
    }
    return { x: normalizedX, y: normalizedY };
  };


  if (inited)
    return;

  elCopy.textContent = chrome.i18n.getMessage("contextMenu_copy");
  elCopyTitle.textContent = chrome.i18n.getMessage("contextMenu_copyTitle");
  
  document.documentElement.addEventListener("contextmenu", e =>
  {
    debug.debug(e);
    if (e.target.closest("#contextMenu"))
      return contextMenuClose(e);

    e.preventDefault();

    if (contextMenuOption)
      contextMenuClose();

    contextMenuOption = e.target.closest(".option:not(.menu)");
    if (!contextMenuOption)
      return contextMenuClose();

  debug.debug(contextMenuOption);
  debug.debug(e.target.getBoundingClientRect());
    document.body.setAttribute("contextMenu", contextMenuOption.dataset.sessionId);
    const pos = normalizePosition(e.clientX, e.clientY);
    elContextMenu.style.left = pos.x + "px";
    elContextMenu.style.top = pos.y + "px";
    debug.debug(pos, e.offsetX, e.offsetY);
    contextMenuOption.classList.add("highlight");
    elContextMenu.focus();
  });

  function contextMenuClose(e)
  {
    if (e)
      e.preventDefault();

    if (!contextMenuOption)
      return;


    debug.debug(e, contextMenuOption);

  debug.debug(e&&e.target);
  debug.debug(elCopy);
    if (e)
    {
      let close = false;
      if (e.target === elCopy)
      {
    debug.debug(contextMenuOption.dataset.url);
        navigator.clipboard.writeText(contextMenuOption.dataset.url);
        close = true;
    //    return;
      }
      else if (e.target === elCopyTitle)
      {
    debug.debug(contextMenuOption.dataset.title);
        navigator.clipboard.writeText(contextMenuOption.dataset.title);
        close = true;
    //    return;
      }
      if (close)
      {
        e.preventDefault();
      }

    }
    document.body.removeAttribute("contextMenu");
    contextMenuOption.classList.remove("highlight");
    contextMenuOption = null;
  }
  document.documentElement.addEventListener("click", contextMenuClose);
  document.documentElement.addEventListener("keydown", contextMenuClose);
  document.addEventListener("scroll", contextMenuClose);
  elContextMenu.addEventListener("blur", e =>
  {
    debug.debug("blur", e);
  });
  inited = true;
}

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.remove('notLoaded');
}, { once: true });
