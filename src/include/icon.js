//icon is too small for showing any meaningful information
//abandon the project
const Icon = (() =>
{
  const cache = new Map();
  const _fetch = file =>
  {
    let icon = cache.get(file);
    if (icon)
      return icon;

    icon = fetch(file)
          .then(r => r.blob())
          .then(createImageBitmap);

    cache.set(file, icon);
    return icon;
  };
  return class Icon
  {
    constructor(iconFile, width = 24, height = 24)
    {
      this.width = width;
      this.height = height;
      this.qList = Promise.resolve();
      this.baseIconFileName = iconFile;
      this.baseIconImageData = null,
      this.id = null,
      this.canvas = new OffscreenCanvas(this.width, this.height);
      this.ctx = this.canvas.getContext("2d");
      this.resetImage();
    }
    queue(func)
    {
      return (this.qList = this.qList.then(func).catch(console.error));
    }
    loadImage(file)
    {
      return this.queue(() => _fetch(file));
    }
    resetImage()
    {
      this.ctx.clearRect(0, 0, this.width, this.height);
      return this.queue(this.drawImage(this.baseIconFileName, 0, 0, this.width, this.height)
                        .then(img => this.baseIconImageData = img));
    }
    drawImage(file, ...args)
    {
      return this.queue(this.loadImage(file)
                        .then(img =>
                        {
                          console.log("appendImage");
                          args.unshift(img);
                          this.ctx.drawImage.apply(this.ctx, args);
                        }));
    }
    setIcon(tabId)
    {
      return this.queue(() =>
      {
console.log(this.ctx.fillStyle);
        chrome.action.setIcon({imageData: this.ctx.getImageData(0, 0, this.width, this.height), tabId});
      });
    }
    getId(opts)
    {
      return "" + [
        this.baseIconFileName,
        this.width, this.height,
        opts.skip,
        // opts.freeze,
        // opts.protect,
        opts.action,
        opts.color
      ];
      
    }
    set(opts)
    {
      const id = this.getId(opts);
      console.log("ICONLOG", opts, id, this.id);
      if (id !== this.id)
      {
        this.resetImage();
        this.id = id;
        this.circle({x: 6, y: 18, radius: 5, startAngle: 0, endAngle: 2 * Math.PI, counterclockwise: false, lineWidth: 0.5, stroke: "red", fill: opts.skip ? "red" : "green"});
        this.circle({x: 18, y: 18, radius: 5, startAngle: 0, endAngle: 2 * Math.PI, counterclockwise: false, lineWidth: 0.5, stroke: "white", fill: opts.action ? "blue" : "transparent"});
      }
      return this.setIcon();
    }
    circle({x, y, radius, startAngle, endAngle, counterclockwise, fill, stroke, lineWidth})
    {
      return this.queue(() =>
      {
        this.ctx.save();
        // this.ctx.moveTo(x,y);
        this.ctx.beginPath();
        if (stroke !== undefined)
          this.ctx.strokeStyle = stroke;

        if (fill)
          this.ctx.fillStyle = fill;

        if (lineWidth !== undefined)
          this.ctx.lineWidth = lineWidth;
  
        this.ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
        if (fill !== undefined)
          this.ctx.fill();

        if (stroke !== undefined)
          this.ctx.stroke();

console.log(x,y, this.ctx.fillStyle);
        this.ctx.restore();
  
      });
    }
  };
})();