import { createApp } from 'vue'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/index.css'
import App from './App.vue'
import router from './router'
import { registerSessionRouter } from './services/sessionManager'

const app = createApp(App)

app.use(router)
registerSessionRouter(router)
app.mount('#app')
