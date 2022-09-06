const messenger = (() =>
{
  const ports = new Map(),
        onConnect = new Map(),
        onDisconnect = new Map(),
        onMessage = new Map();

  chrome.runtime.onConnect.addListener(port =>
  {
    if (port.sender.id !== chrome.runtime.id)
      return;
  
    onConnect.forEach(callback => callback(port));
    ports.set(port, port);
    port.onMessage.addListener((...args) =>
    {
      onMessage.forEach(callback => callback(...args));
    });
    port.onDisconnect.addListener(p =>
    {
      onDisconnect.forEach(callback => callback(p));
      ports.delete(p);
    });
  });
  
  const ret = message =>
  {
    ports.forEach(port => port.postMessage(message));
  };
  ret.onConnect = callback => onConnect.set(callback, callback);
  ret.onDisconnect = callback => onDisconnect.set(callback, callback);
  ret.onMessage = callback => onMessage.set(callback, callback);
  return ret;
})();
