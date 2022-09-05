function truncate (str, n = 50)
{
  str = "" + str;
  return str.length > n ? str.substring(0, (n / 2) - 1) + '…' + str.substring(str.length - (n / 2) + 2, str.length) : str;
//  return (this.length > n) ? this.substr(0, n-1) + '…' : this.toString();
}

function onError(msg)
{
  return er => console.log(msg, er, chrome.runtime.lastError);
}
