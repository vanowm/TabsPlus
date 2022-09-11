class TabsManager
{
  constructor(data = new Map())
  {
    this.data = data;
    this.noChange = false;
    this.listeners = new Map();
    this.loaded = this.load();
    this.fields = {
      skip: true,
      id: false,
      index: false,
      url: true,
      windowId: false,
      // uuid: ""
    };
  }

  add(tab, save = true)
  {
    const tabOld = this.remove(tab, false) || {}; //move tab to the end of the list
    const newTab = this.update(tabOld, tab, true);
    // newTab.uuid = this.getUUID(newTab.url, /*newTab.windowId, */newTab.index);
    this.data.set(newTab.id, newTab);
    debug.trace("TAB.add", {id: tab.id, tab, newTab, save, data: [...this.data.values()]});
    if (save)
      this.save();

    // setIcon(newTab);
    return newTab;
  }

  remove(tab, save = true)
  {
    const ret = this.data.get(tab.id);
    this.data.delete(tab.id);
    // debug.trace("TAB.remove", {id: tab.id, tab, ret, save, data: [...this.data.values()]});
    if (save)
      this.save();

    return ret;
  }

  load()
  {
    return chrome.storage.local.get("tabsList");
  }

  save()
  {
    debug.trace("save", ""+[...this.data.keys()], [...this.data.values()]);
    return new Promise((resolve, reject) =>
    {
      setAlarm(() => chrome.storage.local.set({tabsList:[...this.data.values()]}).then(resolve).catch(er => (debug.error("TABS.save", er), reject(er))), 100, "tabsSave");
    });
  }

  getUUID(...data)
  {
    let str = "";
    for(let n = 0; n < data.length; n++)
    {
      str += data[n];
      let c = 0,
          r = "";

      for (let i = 0; i < str.length; i++)
        c = (c + (str.charCodeAt(i) * (i + 1) - 1)) & 0xfffffffffffff;

      str = str.substring(str.length / 2) + c.toString(16) + str.substring(0, str.length / 2);
      for(let i = 0, p = c + str.length; i < 32; i++)
      {
        if (i == 8 || i == 12 || i == 16 || i == 20)
          r += "-";

        c = p = (str[(i ** i + p + 1) % str.length]).charCodeAt(0) + p + i;
        if (i == 12)
          c = (c % 5) + 1; //1-5
        else if (i == 16)
          c = (c % 4) + 8; //8-B
        else
          c %= 16; //0-F

        r += c.toString(16);
      }
      str = r;
    }
    return str;
  }

  find(tab)
  {
    return this.data.get(tab.id);
  }

  update(dataOld, dataNew, overwrite = false)
  {
    for(let i in this.fields)
    {
      if (i in dataNew && (this.fields[i] || (!this.fields[i] && overwrite)))
        dataOld[i] = dataNew[i];
    }
    return dataOld;
  }

  updateAll(windowId, save = true)
  {
    debug.log("TABS.updateAll", windowId);
    const query = {};
    if (windowId)
      query.windowId = windowId;

    return chrome.tabs.query(query).then(tabs =>
    {
      for(let i = 0; i < tabs.length; i++)
        TABS.update(TABS.find(tabs[i]), tabs[i], true);

      if (save)
        TABS.save();
    });
  }

  last(windowId, skip, skipIds)
  {
    skipIds = skipIds || [];
    let list = Array.from(this.data.values());
    for(let i = list.length - 1; i > -1; i--)
    {
      const tab = list[i];
      if (tab.windowId != windowId)
        continue;

      if ((!skip || (skip && !tab.skip)) && skipIds.indexOf(tab.id) == -1)
        return tab;
    }
    return null;
  }

  activate(tabId)
  {
    return chrome.tabs.update(tabId, {active: true})
            .catch(er => debug.error("TABS.activate", er));
  }

  deactivate(tabId)
  {
    return chrome.tabs.update(tabId, {active: false})
            .catch(er => debug.error("TABS.activate", er));
  }

  win(winId)
  {
    const winIds = (winId !== undefined && !(winId instanceof Array)) ? [winId] : winId;
    const r = {},
          tabs = Array.from(this.data.values());

    for (let i = 0; i < tabs.length; i++)
    {
      const tab = Object.assign({}, tabs[i]),
            windowId = tab.windowId;

      if (winId && winIds.indexOf(windowId) == -1)
        continue;

      if (!r[windowId])
        r[windowId] = [];

      delete tab.windowId;
      r[windowId].push(tab);
    }
    return JSON.stringify(r);
  }

  addListener(type, listener)
  {
    let list;
    if (!(list = this.listeners.get(type)))
    {
      list = new Map();
      this.listeners.set(type, list);
    }
    list.set(listener, type);
  }

  removeListener(type, listener)
  {
    const list = this.listeners.get(type);
    if (!list)
      return;

    list.delete(listener);
  }

  notifyListeners(type, ...args)
  {
    const list = this.listeners.get(type);
    if (!list || !list.size)
      return;

    for(let i = 0, listeners = [...list.keys()]; i < listeners.length; i++)
      listeners[i](...args);
  }
} // class TabsList
