/**
 * Entry point for the Recall Rogue Teacher Dashboard.
 * Mounts the Svelte 5 app into the #app div.
 */
import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
