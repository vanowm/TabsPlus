const port = chrome.runtime.connect(null, {name: "actionPopup"});
port.onMessage.addListener((message, _port) =>
{
  switch(message.type)
  {
    case "prefs":
      init(message.data);
      break;
    case "prefChanged":
      port.postMessage({type: "prefs"});
      break;
  }
});
port.postMessage({type: "prefs"});
let inited = false;
function init (prefs)
{
  const elMenu = document.getElementById("list"),
        elCopy = document.getElementById("copy");

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
  debug.log(i, sessions[i]);
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

          e.stopPropagation();
          const sub = e.target.classList.contains("sub") ? e.target : e.target.parentNode.classList.contains("sub") ? e.target.parentNode : null;
          if (sub)
            return option.classList.toggle("open");

          if (!isMenu || (isMenu && option.querySelector(":hover") === elTitle))
          {
  debug.log("restore", session.sessionId);
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


  document.getElementById("copy").textContent = chrome.i18n.getMessage("contextMenu_copy");
  if (inited)
    return;

  document.documentElement.addEventListener("contextmenu", e =>
  {
    debug.log(e);
    if (e.target.closest("#contextMenu"))
      return contextMenuClose(e);

    e.preventDefault();

    if (contextMenuOption)
      contextMenuClose();

    contextMenuOption = e.target.closest(".option:not(.menu)");
    if (!contextMenuOption)
      return contextMenuClose();

  debug.log(contextMenuOption);
  debug.log(e.target.getBoundingClientRect());
    document.body.setAttribute("contextMenu", contextMenuOption.dataset.sessionId);
    const pos = normalizePosition(e.clientX, e.clientY);
    elContextMenu.style.left = pos.x + "px";
    elContextMenu.style.top = pos.y + "px";
    debug.log(pos, e.offsetX, e.offsetY);
    contextMenuOption.classList.add("highlight");
    elContextMenu.focus();
  });

  function contextMenuClose(e)
  {
    if (!contextMenuOption)
      return;


    debug.log(e, contextMenuOption);
    if (e)
      e.preventDefault();

  debug.log(e&&e.target);
  debug.log(elCopy);
    if (e && e.target === elCopy)
    {
  debug.log(contextMenuOption.dataset.url);
      navigator.clipboard.writeText(contextMenuOption.dataset.url);
  //    return;
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
    debug.log("blur", e);
  });
  inited = true;
}

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.remove('notLoaded');
}, { once: true });
