// https://codesandbox.io/s/github/jacomyal/sigma.js/tree/main/examples/use-reducers?file=/index.ts:2899-2903
// https://codesandbox.io/s/layouts-ekjy6?file=/index.ts:4284-4288

// See https://www.npmjs.com/package/crytoscape documentation.
import { Sigma } from 'https://esm.run/sigma'
import { animateNodes } from 'https://esm.run/sigma/utils/animate'
import Graph from 'https://esm.run/graphology'
import { circular } from 'https://esm.run/graphology-layout'
import FA2Layout from 'https://esm.run/graphology-layout-forceatlas2/worker'
import forceAtlas2 from 'https://esm.run/graphology-layout-forceatlas2'

const container = document.querySelector('#graph')
const modal = document.querySelector('.modal')
const form = document.querySelector('#mastodon-input')
const input = document.querySelector('#url-input')
const toolbar = document.querySelector('#toolbar')
const inspector = document.querySelector('#inspector')
const instanceTemplate = document.querySelector('#inspector-instance-template')
const errorTemplate = document.querySelector('#inspector-error-template')

const randomColor = () => '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0')
const blacklist = ['.*\.activitypub\-troll\.cf']

form.addEventListener('submit', e => {
  e.preventDefault()
  if (isValidUrl(input.value)) {
    init(input.value)
  } else {
    const feedback = modal.querySelector('#feedback')
    feedback.innerText = 'Invalid URL'
    feedback.classList.add('error')
  }
})

let graph
let renderer

function isValidUrl(string) {
  let url

  try {
    url = new URL(string)
  } catch (_) {
    return false
  }

  return url.protocol === "http:" || url.protocol === "https:"
}

function gaussianRandom(mean = 0, stdev = 1) {
  const u = 1 - Math.random()
  const v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return z * stdev + mean
}

async function init(initialUrl) {
  modal.remove()
  graph = new Graph()

  await loadInstance(initialUrl)

  const settings = forceAtlas2.inferSettings(graph)
  const fa2Layout = new FA2Layout(graph, {
    settings: settings
  })

  circular(graph, { scale: 1 })

  renderer = new Sigma(graph, container)
  renderer.on('clickNode', e => {
    onNodeClick(e)
  })

  fa2Layout.start()
}

function removeChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.lastChild)
  }
}

function createInstanceInspector(meta) {
  const instance = instanceTemplate.content.cloneNode(true)
  instance.querySelector('.title').innerText = meta.title
  instance.querySelector('.thumbnail').src = meta.thumbnail
  instance.querySelector('.description').innerText = meta.description

  const load = instance.querySelector('#load')
  load.addEventListener('click', async () => {
    load.disabled = true
    if (!(await loadInstance(meta.uri))) {
      load.disabled = false
    }
  })

  return instance
}

function createErrorInspector(uri) {
  const instance = errorTemplate.content.cloneNode(true)
  instance.querySelector('.description').innerText = `Could not load ${uri}.`

  instance.querySelector('#remove').addEventListener('click', () => {
    graph.dropNode(uri)
    hideInspector()
  })

  return instance
}

function updateInspector(node) {
  removeChildren(inspector)
  inspector.appendChild(node)
}

function showInspector() {
  inspector.classList.remove('hidden')
}

function hideInspector() {
  inspector.classList.add('hidden')
}

async function onNodeClick(e) {
  try {
    const meta = await queryInstance(e.node)
    const instance = createInstanceInspector(meta)
    updateInspector(instance)
  } catch {
    const error = createErrorInspector(e.node)
    updateInspector(error)
  }
  showInspector()
}

async function loadInstance(url) {
  const instancePromise = queryInstance(url)
  const peersPromise = queryPeers(url)

  try {
    const [instance, peers] = await Promise.all([instancePromise, peersPromise])
    const filtered = peers.filter(peer => !blacklist.some(domain => ~peer.search(RegExp(domain))))
    const thisColor = randomColor()
    const childColor = randomColor()

    let x = 0
    let y = 0
    if (graph.hasNode(instance.uri)) {
      graph.updateNode(instance.uri, attr => {
        x = attr.x
        y = attr.y

        return {
          ...attr,
          color: thisColor,
          label: instance.uri,
          data: instance
        }
      })
    } else {
      graph.addNode(instance.uri, {
        x: 0,
        y: 0,
        color: thisColor,
        label: instance.uri,
        data: instance
      })
    }

    filtered.forEach(peer => {
      if (!graph.hasNode(peer)) {
        graph.addNode(peer, {
          label: peer,
          color: childColor,
          x: x + gaussianRandom(),
          y: y + gaussianRandom()
        })
      }

      graph.addEdge(instance.uri, peer)
    })

    return true
  } catch (err) {
    console.error(url, err)
    return false
  }
}

function formatUrl(url) {
  return url.replace(/https?\:\/\//, '').replace(/\/$/, '')
}

function queryInstance(url) {
  return fetch(`https://${formatUrl(url)}/api/v1/instance`, {
  }).then(res => res.json())
}

function queryPeers(url) {
  return fetch(`https://${formatUrl(url)}/api/v1/instance/peers`, {
  }).then(res => res.json())
}

function createGraph() {
  const graph = new Graph()
}