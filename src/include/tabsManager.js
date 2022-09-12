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
      windowId: false,
      windowUUID: false,
      tabUUID: false,
      /*these needed for uuid generation*/
      index: false,
      url: true,
      title: true,
      autoDiscardable: true,
      discarded: true,
      favIconUrl: true,
      pinned: true,
    };
  }

  add(tab, save = true)
  {
    const tabOld = this.remove(tab, false) || {}; //move tab to the end of the list
    const newTab = this.update(tabOld, tab, true);
    this.data.set(newTab.id, newTab);
    this.setUUID(newTab);
    this.setWinUUID(newTab);
    debug.trace("TAB.add", {id: tab.id, tabUUID: newTab.tabUUID, windowUUID: newTab.windowUUID, tab, newTab, save, data: [...this.data.values()]});
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
    return new Promise((resolve, reject) =>
    {
      const tabsList = [...this.data.values()];
      const id = this.getUUID(new Date().getTime())
      debug.trace("save", id, ""+[...this.data.keys()], tabsList.map(a => Object.assign({}, a)));
      setAlarm(() => chrome.storage.local.set({tabsList})
              .then(res =>
              {
                debug.trace("save alarm", id, res, ""+[...this.data.keys()], tabsList);
                resolve(res);
              })
              .catch(er => (debug.error("TABS.save", er), reject(er))), 100, "tabsSave");
    });
  }

  setWinUUID(tab, save = true)
  {
    let list = Array.from(this.data.values()),
        uuid = "",
        uuidList = [];

    for(let i = 0; i < list.length; i++)
    {
      const listTab = list[i];
      if (listTab.windowId !== tab.windowId)
        continue;

      uuidList[uuidList.length] = listTab;
    }
    uuidList.sort((a, b) => a.index - b.index).map(a => uuid = this.getUUID(uuid + a.tabUUID));

    uuid = this.getUUID(uuid + this.getUUID(uuidList.length));
    if (save)
    {
      for(let i = 0; i < uuidList.length; i++)
      {
        uuidList[i].windowUUID = uuid;
      }
    }
    return uuid;
  }

  setUUID(tab, save = true)
  {
    const data = [tab.url, /*tab.title, */tab.index, tab.autoDiscardable, /*tab.discarded,*/ tab.favIconUrl, tab.pinned];
    let uuid = "";
    for(let i = 0; i < data.length; i++)
    {
      uuid = this.getUUID(uuid + data[i]);
    }
    if (save)
      tab.tabUUID = uuid;

    return uuid;
  }

  getUUID(str)
  {
    str = "" + str;
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
    return r;
  }

  find(tab)
  {
    return tab && this.data.get(tab.id);
  }

  update(dataOld, dataNew, overwrite = false)
  {
    if (!dataOld)
      return dataOld;

    for(let i in this.fields)
    {
      if (i in dataNew && (this.fields[i] || (!this.fields[i] && overwrite)))
        dataOld[i] = dataNew[i];
    }
    return dataOld;
  }

  updateAll(windowId, save = true)
  {
    debug.debug("TABS.updateAll", windowId);
    const query = {};
    if (windowId)
      query.windowId = windowId;

    return chrome.tabs.query(query).then(tabs =>
    {
      for(let i = 0; i < tabs.length; i++)
      {
        const tab = TABS.update(TABS.find(tabs[i]), tabs[i], true);
        this.getUUID(tab);
      }

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
