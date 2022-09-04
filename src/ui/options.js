const $ = id => document.getElementById(id),
      app = chrome.runtime.getManifest(),
      _ = chrome.i18n.getMessage;

(function()
{
  let i18nRegExp = /\${((\w+)\.)?([^}]+)}/g,
      tags = {
        app: app,
        undefined: new Proxy(
        {},
        {
          get(obj, name) {return Object.hasOwnProperty.call(obj, name) ? obj[name] : _(name);},
        })
      },
      i18n = (a,b,c,d) => tags[c][d];

  (function loop(node)
  {
    if (node.attributes)
      for(let i = 0; i < node.attributes.length; i++)
        node.attributes[i].value = node.attributes[i].value.replace(i18nRegExp, i18n);

    if (!node.childNodes.length)
      node.textContent = node.textContent.replace(i18nRegExp, i18n);
    else
      for(let i = 0; i < node.childNodes.length; i++)
        loop(node.childNodes[i]);
  })(document.body.parentNode);
})();

chrome.runtime.sendMessage(null, {type: "prefs"}, ({data: prefs}) =>
{
  const elOpt = document.querySelector("#options > .table"),
        template = elOpt.removeChild(elOpt.firstElementChild),
        elRestore = $("restore"),
        elRestoreFile = $("restoreFile"),
        elBackup = $("backup"),
        elHeader = $("header"),
        elOptWin = $("options_window"),
        elBackupRestore = $("backupRestore"),
        elOptions = $("options"),
        elExit = $("exit"),
        rectExit = elExit.getBoundingClientRect();

  let rectOptWin;
  for (let o in prefs)
  {
    if (!prefs[o].options)
      continue;

    const group = (prefs[o].group && elOpt.querySelector('[group="' + prefs[o].group + '"]')) || template.cloneNode(false);
    const row = template.querySelector(".row").cloneNode(true);
    group.appendChild(row);

    if (prefs[o].group)
    {
        group.setAttribute("group", prefs[o].group);
    }
    row.id = o + "Box";

    let cur = prefs[o].value;
    const isBool = prefs[o].options.length == 2,
          option = isBool ? document.createElement("input") : row.querySelector("select");

    if (cur === undefined || cur < 0 || cur > prefs[o].options.length)
      cur = prefs[o].default;

    if (isBool)
    {
      option.checked = cur ? true : false;
      option.type = "checkbox";
      const select = row.querySelector("select");
      select.parentNode.replaceChild(option, select);
      row.classList.add("checkbox");
    }
    else
    {
      row.classList.add("select");
      for (let i = 0, elOpt = document.createElement("option"); i < prefs[o].options.length; i++)
      {
        const opt = elOpt.cloneNode(true);
        opt.value = prefs[o].options[i].id;
        opt.textContent = prefs[o].options[i].name;
        if (prefs[o].options[i].description)
          opt.title = prefs[o].options[i].description;

        if (prefs[o].default == i)
          opt.className = "default";

        option.appendChild(opt);
      }
      option.value = cur;
      option.classList.toggle("default", cur === prefs[o].default);
    }
    prefs[o].input = option;
    option.addEventListener("input", onChange);
    option.id = o;
    if (option.selectedOptions)
      option.title = option.selectedOptions[0].textContent;

    if (prefs[o].description)
    {
      row.title = prefs[o].description;
    }
    row.querySelector(".label").textContent = prefs[o].label;
    elOpt.appendChild(group);
    row.addEventListener("click", e =>
    {
      if (isBool)
      {
        if (e.target.classList.contains("label"))
          option.click();
      }
      else
        option.focus();
    });
    if (onChange[prefs[o].onChange] instanceof Function)
      onChange[prefs[o].onChange](o, cur);

  }

  elBackupRestore.addEventListener("input", e =>
  {
    let data = {},
        err = false,
        value = elBackupRestore.value.trim();
    try
    {
      data = JSON.parse(value);
    }
    catch (er)
    {
      err = true;
    }
    let o = getBackupData(),
        changed = false;

    for(let i in o)
    {
      if (i in data && o[i] !== data[i])
      {
        changed = true;
        break;
      }
    }
    e.target.classList.toggle("error", value !== "" && err);
    elRestore.disabled = !changed || !Object.keys(data).length;
    elBackup.disabled = value !== "" && err;
  });

  elRestore.addEventListener("click", e =>
  {
    let data = {};
    try
    {
      data = JSON.parse(elBackupRestore.value.trim());
    }
    catch (er){}
    console.log(restore(data));
    backupRestore();
  });

  elRestoreFile.addEventListener("click", async e =>
  {
    const opts = {
      types: [{
        description: app.name + " " + _("settings"),
        accept: {
          'text/json': ['.json']
        },
      }],
      excludeAcceptAllOption: true,
      multiple: false
    };
    let fileHandle;
    try
    {
      [fileHandle] = await window.showOpenFilePicker(opts);
    }
    catch(er){return;}
    file = await fileHandle.getFile();
    contents = await file.text();

    let data = {};
    try
    {
      data = JSON.parse(contents);
    }
    catch (er){}
    console.log(restore(data));
    backupRestore();
  });

  elBackup.addEventListener("click", async e =>
  {
    const d = new Date(),
          pad = t => ("" + t).padStart(2, "0"),
		      options = {
            suggestedName: app.name + "_" + _("settings") + "_v" + app.version + "_"
                            + d.getFullYear()
                            + pad(d.getMonth() + 1)
                            + pad(d.getDate())
                            + pad(d.getHours())
                            + pad(d.getMinutes())
                            + pad(d.getSeconds()),
            types: [
              {
                description: app.name + _("settings"),
                accept: {
                  '*/*': ['.json'],
                },
              },
            ],
            excludeAcceptAllOption: true,
            multiple: false
          };
    let fileHandle;
    try
    {
      fileHandle = await window.showSaveFilePicker(options);
    }
    catch(er){return;}

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(getBackupData()));
    await writable.close();
  });

  const port = chrome.runtime.connect(null, {name: "options"});
  port.onMessage.addListener((message, _port) =>
  {
    switch(message.type)
    {
      case "prefChanged":
        setOption(message.name, message.newValue, false);
        break;
  
    }
  });
  
  function restore(data)
  {
    const r = {restored:[], error:[]};
    for(let i in data)
    {
      const er = (!prefs[i] && 1)
               + (prefs[i] && (typeof(prefs[i].default)) != typeof(data[i]) ? 2 : 0)
//                 + (prefs[i] && !prefs[i].options ? 4 : 0)
//                 + (i == "version" ? 4 : 0)
               + (prefs[i] && prefs[i].options && !prefs[i].options[data[i]] ? 8 : 0);
      if (er || i == "version")
      {
        console.log("skipped", i, "value", data[i], "error code", er);
        r.error[r.error.length] = i;
        continue;
      }

      setOption(i, data[i]);

      r.restored[r.restored.length] = i;
    }
    return r;
  }

  function onChange(e)
  {
    const option = e.target;
    const value = ~~(option.type == "checkbox" ? option.checked : option.value);
    option.classList.toggle("default", value == prefs[option.id].default);
    prefs[option.id].value = value;
    let o = {};
    o[option.id] = value;
    if (onChange[prefs[option.id].onChange] instanceof Function)
      onChange[prefs[option.id].onChange](option.id, value);


    switch(option.id)
    {
        case "syncSettings":
          o = Object.assign(o, getBackupData());
          break;

    }
    if (option.selectedOptions)
      option.title = option.selectedOptions[0].textContent;

    for(let i in o)
    {
      chrome.runtime.sendMessage(null,
      {
        type: "pref",
        name: i,
        value: o[i]
      }, resp => {});
    }
    backupRestore();
    enableDisable();
  }

  function enableDisable()
  {
    prefs.expandWindow.input.disabled = prefs.iconAction.value != ACTION_LIST;
    prefs.expandWindow.input.closest(".row").classList.toggle("hidden", prefs.expandWindow.input.disabled);
  }

  function setOption(id, value, save)
  {
    const elOpt = $(id);
    if (!elOpt)
    {
      if (onChange[prefs[id].onChange] instanceof Function)
        onChange[prefs[id].onChange](id, value);

        if (save || save === undefined)
          chrome.runtime.sendMessage(null,
          {
            type: "pref",
            name: id,
            value: value
          }, resp => {});

      return;
    }
    let changed;
    if (elOpt.type == "checkbox")
    {
      changed = elOpt.checked != value;
      elOpt.checked = value;
    }
    else
    {
      changed = elOpt.value != value;
      elOpt.value = value;
    }
    if (changed)
      elOpt.dispatchEvent(new Event("input"));
  }
 
  function getBackupData()
  {
    const o = {};
    for(let i in prefs)
      o[i] = prefs[i].value;

    return o;
  }

  function backupRestore()
  {
    elBackupRestore.value = JSON.stringify(getBackupData());
    elBackupRestore.classList.remove("error");
    elRestore.disabled = true;
    elBackup.disabled = false;
  }

  /* window handler */
  function onMouseMove(e)
  {
  	if (!win.move)
  		return;

    if (elOptWin.classList.contains("maximized"))
    {
      let x = rectOptWin.x + win.offsetX, //get orig cursor position
          y = rectOptWin.y + win.offsetY;

      if (x == e.x && y == e.y)
        return;

      let p = x * 100 / rectOptWin.width;
      elOptWin.style.top = 0;
      elOptWin.classList.remove("maximized");
      rectOptWin = elOptWin.getBoundingClientRect();
      const newX = p * rectOptWin.width / 100;
      elOptWin.style.left = newX + "px";
      rectOptWin = elOptWin.getBoundingClientRect();
      win.offsetX = x - newX - (x >= rectOptWin.right - rectExit.width ? x - (rectOptWin.right - rectExit.width - 2) : 0);
    }
    let x = Math.max(e.x - win.offsetX, 0),
        y = Math.max(e.y - win.offsetY, 0);

    if (rectOptWin.width > win.rectBody.width)
    {
    	elOptWin.style.width = win.rectBody.width + "px";
      rectOptWin.width = win.rectBody.width;
    }

    if (rectOptWin.height > win.rectBody.height)
    {
    	elOptWin.style.height = win.rectBody.height + "px";
      rectOptWin.height = win.rectBody.height;
    }

    if (x + rectOptWin.width > win.rectBody.width)
      x = win.rectBody.width - rectOptWin.width;

    if (y + rectOptWin.height > win.rectBody.height)
      y = win.rectBody.height - rectOptWin.height;


    if (x == rectOptWin.x && y == rectOptWin.y)
      return;

  	elOptWin.style.left = x + "px";
  	elOptWin.style.top = y + "px";
  	savePos();
  }

  function onMouseDown(e)
  {
    if (e.target === elExit)// || elOptWin.classList.contains("maximized"))
      return;

    win.move = true;
    rectOptWin = elOptWin.getBoundingClientRect();
    win.rectBody = document.body.getBoundingClientRect();
  	win.offsetX = e.x - rectOptWin.x;
  	win.offsetY = e.y - rectOptWin.y;
  	e.stopPropagation();
  }

  function onMouseUp(e)
  {
    win.move = false;
  }

  function savePos()
  {
    win.rectBody = document.body.getBoundingClientRect();
    prefs.optWin.value = [
      (elOptWin.style.left ? parseFloat(elOptWin.style.left) : rectOptWin.left) || "",
      (elOptWin.style.top ? parseFloat(elOptWin.style.top) : rectOptWin.top) || "",
      (elOptWin.style.width ? parseFloat(elOptWin.style.width) : rectOptWin.width) || "",
      (elOptWin.style.height ? parseFloat(elOptWin.style.height) : rectOptWin.height) || "",
      ~~elOptWin.classList.contains("maximized") || ""].join("|");

    if (!savePos.timer)
    {
      const time = 500;
      let i = -1;
      (function loop(e)
      {
        if (!savePos.timer)
          savePos.timer = setInterval(loop, 10);

        if (savePos.optWin === prefs.optWin.value)
        {
          clearInterval(savePos.timer);
          savePos.timer = null;
          savePos.optWin = null;
          i = time;
        }
        else
          savePos.optWin = prefs.optWin.value;

        if (++i > time || !i)
        {
          i = 0;
          chrome.runtime.sendMessage(null,
          {
            type: "pref",
            name: "optWin",
            value: prefs.optWin.value
          }, resp =>
          {
            backupRestore();
          });
          return;
        }
      })();
    }
  }

  const win = {
    heightDif: elOptWin.scrollHeight - elOptions.scrollHeight,
    textAreaDif: elOptWin.scrollHeight - elBackupRestore.scrollHeight,
    move: false,
  };

  elOptWin.style.minHeight = elOptions.scrollHeight + win.heightDif + "px";
  rectOptWin = elOptWin.getBoundingClientRect();
  win.rectBody = document.body.getBoundingClientRect();
	elOptWin.style.left = (win.rectBody.width - rectOptWin.width) / 2 + "px";
	elOptWin.style.top = (win.rectBody.height - rectOptWin.height) / 2  + "px";

  prefs.optWin.value = prefs.optWin.value && prefs.optWin.value.split("|").map(n => Number(n)) || [];
  if (prefs.optWin.value.length)
  {
    let [winX, winY, winW, winH, winM] = prefs.optWin.value;

    winW = Math.max(winW, rectOptWin.width);
    winH = Math.max(winH, rectOptWin.height);
    elOptWin.style.left = Math.max(0, Math.min(win.rectBody.width - winW, winX)) + "px";
    elOptWin.style.top = Math.max(0, (winY + winH > win.rectBody.height ? win.rectBody.height - winH : winY)) + "px";
    elOptWin.style.width = winW + "px";
    elOptWin.style.height = winH + "px";
    elOptWin.classList.toggle("maximized", winM);
  }
  new ResizeObserver(e =>
  {
    if (elOptWin.style.height !== "")
      elOptWin.classList.add("resized");

    savePos();
  }).observe(elOptWin);

  elHeader.addEventListener("mousedown", onMouseDown);
  elHeader.addEventListener("dblclick", e => elOptWin.classList.toggle("maximized"));
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  /* window handler end */

  elExit.addEventListener("click", e => window.close());
  backupRestore();
  enableDisable();
  document.body.classList.remove("hide");
});
