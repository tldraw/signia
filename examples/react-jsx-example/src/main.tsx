import React from 'react'
import ReactDOM from 'react-dom/client'
import { install } from 'tlstate-react-jsx'
import App from './App'

install()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
