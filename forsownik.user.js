// ==UserScript==
// @name        Kara Forsownik
// @namespace   https://github.com/lisku
// @description Skrypt do dumpowania na kurahenie
// @include     https://kara.8ch.net/*/res/*
// @include     http://kara.8ch.net/*/res/*
// @include     http://karachan.org/*/res/*
// @version     1
// @grant       GM_addStyle
// ==/UserScript==

'use strict'

GM_addStyle(`
  #dumplist {
    position: fixed;
    bottom: 10px;
    left: 10px;
    color: #ddd;
    background: rgba(0, 0, 0, 0.2);
    transition: background-color .6s, opacity .6s;
  }
  #dumplist.empty {
    opacity: 0;
    pointer-events: none;
  }
  #dumplist:hover {
    background: rgba(0, 0, 0, 0.8);
  }
  #dumplist .list {
    padding-left: 20px;
    max-height: 1px;
    overflow-x: hidden;
    overflow-y: scroll;
    white-space: nowrap;
    transition: max-height .4s;
  }
  #dumplist:hover .list {
    max-height: 500px;
  }
  #dumplist .controls,
  #dumplist .message {
    text-align: center;
  }
  #dumplist .list li,
  #dumplist .controls,
  #dumplist .message {
    margin: 10px;
  }
  #dumplist .list li img,
  #dumplist .list li video {
    max-width: 64px;
    max-height: 64px;
    vertical-align: middle;
  }
  #dumplist .controls select,
  #dumplist .controls button {
    min-width: 64px;
    margin: 0 10px;
  }
`)

function DumpList() {

  this.counter = Infinity
  this.dumping = false
  this.uploading = false
  this.interval = 20

  setInterval(() => {
    this.counter += 1
    if (this.counter > this.interval) {
      if (this.dumping && !this.uploading && !this.isEmpty()) {
        this.controls.dump.textContent = '0%'
        this.uploading = true
        this.submit()
        .then(() => {
          this.counter = 0
          //document.querySelector('.navLinks .updateLink').click()
          this.message.textContent = ''
        })
        .catch(e => {
          this.message.textContent = `${e.res.title}: ${e.res.msg}`
          if (e.res.navigation && e.res.navigation['Zlokalizuj plik'])
            this.message.innerHTML +=
            ` <a href="${e.res.navigation['Zlokalizuj plik'].href}">(tutaj)</a>`
          this.counter = this.interval - 10
          if (e.res.statusCode == 118) this.dumping = false
        })
        .catch(() => {})
        .then(() => {
          this.uploading = false
        })
      }
    }
    if (!this.uploading) {
      if (this.dumping) {
        this.controls.dump.textContent =
          Math.max(this.interval - this.counter, 0)
      }
      else {
        this.controls.dump.textContent = 'Dumpuj'
      }
    }
    this.panel.classList.toggle('empty', this.isEmpty() && !this.dumping)
  }, 1000)

  document.body.addEventListener('dragover', ev => {
    ev.stopPropagation()
    ev.preventDefault()
    ev.currentTarget.classList.add('drag')
  })

  document.body.addEventListener('dragleave', ev => {
    ev.stopPropagation()
    ev.preventDefault()
    ev.currentTarget.classList.remove('drag')
  })

  document.body.addEventListener('drop', ev => {
    if (ev.target.nodeName == 'INPUT' && ev.target.type == 'file') return
    ev.stopPropagation()
    ev.preventDefault()
    ev.currentTarget.classList.remove('drag')
    for (let file of ev.dataTransfer.files) {
      this.addItem(file)
    }
  })

  this.panel = document.createElement('div')
  this.panel.id = 'dumplist'
  this.panel.classList.add('empty')
  document.body.appendChild(this.panel)

  this.list = document.createElement('ol')
  this.list.classList.add('list')
  this.panel.appendChild(this.list)

  this.message = document.createElement('p')
  this.message.classList.add('message')
  this.panel.appendChild(this.message)

  this.controls = document.createElement('div')
  this.controls.classList.add('controls')
  this.panel.appendChild(this.controls)

  this.controls.dump = document.createElement('button')
  this.controls.dump.textContent = 'Dumpuj'
  this.controls.dump.addEventListener('click', () => {
    this.dumping = !this.dumping
  })
  this.controls.appendChild(this.controls.dump)

  this.controls.interval = document.createElement('select')
  this.controls.interval.addEventListener('change', () => {
    this.interval = parseInt(this.controls.interval.value) || 20
  })
  this.controls.appendChild(this.controls.interval)
  ;[
    [20, '20s'], [60, '1min'], [300, '5min'],
    [600, '10min'], [1800, '30min'], [3600, '1h'],
  ].forEach(o => {
    let opt = document.createElement('option')
    opt.value = o[0]
    opt.textContent = o[1]
    this.controls.interval.appendChild(opt)
  })

  console.log('Kara Dumplist jeździ')

}

DumpList.prototype.addItem = function (file) {

  let item = document.createElement('li')
  item.file = file

  if (file.type.match(/^image/)) {
    let img = document.createElement('img')
    img.src = URL.createObjectURL(file)
    item.appendChild(img)
  }
  else if (file.type.match(/^video/)) {
    let vid = document.createElement('video')
    vid.src = URL.createObjectURL(file)
    vid.loop = true
    vid.volume = 0.1
    item.appendChild(vid)
  }

  let span = document.createElement('span')
  span.textContent = ' ' + file.name.replace(/(.{20}).*/, '$1...')
  item.appendChild(span)

  this.list.appendChild(item)

}

DumpList.prototype.isEmpty = function () {
  return !this.list.firstElementChild
}

DumpList.prototype.submit = function () {

  return new Promise((ok, fail) => {

    let item = this.list.firstElementChild
    if (!item) return fail(Error('Dump lista jest pusta'))

    let fd = new FormData()
    ;['mode', 'board', 'resto', 'pwd', 'OPcb']
    .forEach(n => {
      let input = document.querySelector(`#postform input[name=${n}]`)
      if (input) fd.append(n, input.value)
    })
    fd.append('name', '')
    fd.append('email', '')
    fd.append('sub', '')
    fd.append('com', '')
    fd.append('upfile', item.file)
    fd.append('format', 'json')



    let req = new XMLHttpRequest()
    req.responseType = 'json'
    req.upload.addEventListener('progress', ev => {
      this.controls.dump.textContent =
        Math.floor(ev.loaded / ev.total * 100) + '%'
    })
    req.addEventListener('loadend', ev => {
      if (!req.response.statusCode || req.response.statusCode == 200) {
        this.list.removeChild(item)
        ok()
      }
      else {
        let e = Error(req.response.title + ' - ' + req.response.msg)
        e.res = req.response || {}
        fail(e)
      }
    })
    req.open('POST', '/imgboard.php')
    req.send(fd)

  })

}



let dumplist = new DumpList()
