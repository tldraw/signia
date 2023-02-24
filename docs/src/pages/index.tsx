import useBaseUrl from '@docusaurus/useBaseUrl'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import HomepageFeatures from '@site/src/components/HomepageFeatures'
import Layout from '@theme/Layout'
import ThemedImage from '@theme/ThemedImage'
import React from 'react'

function HomepageHeader() {
	return (
		<header style={{ display: 'flex', justifyContent: 'center' }}>
			<ThemedImage
				alt="Docusaurus themed image"
				style={{ maxWidth: '900px' }}
				sources={{
					light: useBaseUrl('/img/hero-light.svg'),
					dark: useBaseUrl('/img/hero-dark.svg'),
				}}
			/>
		</header>
	)
}

export default function Home(): JSX.Element {
	const { siteConfig } = useDocusaurusContext()
	return (
		<Layout
			title={`Hello from ${siteConfig.title}`}
			description="Description will go into a meta tag in <head />"
		>
			<HomepageHeader />
			<main>
				<HomepageFeatures />
			</main>
		</Layout>
	)
}
