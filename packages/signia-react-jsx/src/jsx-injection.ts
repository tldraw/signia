// This file was copied and adapted with thanks from the preactjs/preact repo.
// https://github.com/preactjs/signals/blob/main/packages/react/src/index.ts

// The MIT License (MIT)

// Copyright (c) 2022-present Preact Team

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import React, { Component, type FunctionComponent } from 'react'
import jsxRuntimeDev from 'react/jsx-dev-runtime'
import jsxRuntime from 'react/jsx-runtime'
import { useStateTracking } from 'signia-react'

export interface JsxRuntimeModule {
	jsx?(type: any, ...rest: any[]): unknown
	jsxs?(type: any, ...rest: any[]): unknown
	jsxDEV?(type: any, ...rest: any[]): unknown
}

const ReactMemoType = Symbol.for('react.memo') // https://github.com/facebook/react/blob/346c7d4c43a0717302d446da9e7423a8e28d8996/packages/shared/ReactSymbols.js#L30
const ReactForwardRefType = Symbol.for('react.forward_ref')
const ProxyInstance = new WeakMap<FunctionComponent<any>, FunctionComponent<any>>()
const SupportsProxy = typeof Proxy === 'function'

const ProxyHandlers = {
	/**
	 * This is a function call trap for functional components. When this is called, we know it means
	 * React did run 'Component()', that means we can use any hooks here to setup our effect and
	 * store.
	 *
	 * With the native Proxy, all other calls such as access/setting to/of properties will be
	 * forwarded to the target Component, so we don't need to copy the Component's own or inherited
	 * properties.
	 *
	 * @see https://github.com/facebook/react/blob/2d80a0cd690bb5650b6c8a6c079a87b5dc42bd15/packages/react-reconciler/src/ReactFiberHooks.old.js#L460
	 */
	apply(Component: FunctionComponent, thisArg: any, argumentsList: any) {
		return useStateTracking(`tracked(${Component.name})`, () =>
			Component.apply(thisArg, argumentsList)
		)
	},
}

function ProxyFunctionalComponent(Component: FunctionComponent<any>) {
	return ProxyInstance.get(Component) || WrapWithProxy(Component)
}
function WrapWithProxy(Component: FunctionComponent<any>) {
	if (SupportsProxy) {
		const ProxyComponent = new Proxy(Component, ProxyHandlers)

		ProxyInstance.set(Component, ProxyComponent)
		ProxyInstance.set(ProxyComponent, ProxyComponent)

		return ProxyComponent
	}

	/**
	 * Emulate a Proxy if environment doesn't support it.
	 *
	 * @example
	 * 	- works with Proxy, doesn't with wrapped function.
	 * 	```
	 * 	const el = <SomeFunctionalComponent />
	 * 	el.type.someOwnOrInheritedProperty;
	 * 	el.type.defaultProps;
	 * 	```
	 *
	 * @todo - Unlike Proxy, it's not possible to access the type/Component's static properties this
	 *   way. Not sure if we want to copy all statics here. Omitting this for now.
	 */
	const WrappedComponent = function () {
		// eslint-disable-next-line prefer-rest-params
		return ProxyHandlers.apply(Component, undefined, arguments)
	}
	ProxyInstance.set(Component, WrappedComponent)
	ProxyInstance.set(WrappedComponent, WrappedComponent)

	return WrappedComponent
}

function WrapJsx<T>(jsx: T): T {
	if (typeof jsx !== 'function') return jsx

	return function (type: any, props: any, ...rest: any[]) {
		if (typeof type === 'function' && !(type instanceof Component)) {
			return jsx.call(jsx, ProxyFunctionalComponent(type), props, ...rest)
		}

		if (type && typeof type === 'object') {
			if (type.$$typeof === ReactMemoType) {
				type.type = ProxyFunctionalComponent(type.type)
			} else if (type.$$typeof === ReactForwardRefType) {
				type.render = ProxyFunctionalComponent(type.render)
			}
		}

		return jsx.call(jsx, type, props, ...rest)
	} as any as T
}

const JsxPro: JsxRuntimeModule = jsxRuntime
const JsxDev: JsxRuntimeModule = jsxRuntimeDev

/**
 * Installs jsx integration for signia, causing all functional components to become reactive.
 *
 * Any signals that any component reads during its render will be tracked.
 * This means that if any of those signals change, the component will be re-rendered.
 *
 * Beware! This method uses internal React APIs, so it may break in future major versions of React.
 *
 * Note that, unlike [[signia-react.track]], this will not wrap components with React.memo since that may
 * cause bugs in any 3rd party libraries which use mutable props.
 *
 * Also note that this will not work for class components.
 *
 * @public
 */
export function install() {
	if (didInstall) return
	didInstall = true
	/**
	 * CreateElement _may_ be called by jsx runtime as a fallback in certain cases, so we need to wrap
	 * it regardless.
	 *
	 * The jsx exports depend on the `NODE_ENV` var to ensure the users' bundler doesn't include both,
	 * so one of them will be set with `undefined` values.
	 */
	React.createElement = WrapJsx(React.createElement)
	JsxDev.jsx && /*   */ (JsxDev.jsx = WrapJsx(JsxDev.jsx))
	JsxPro.jsx && /*   */ (JsxPro.jsx = WrapJsx(JsxPro.jsx))
	JsxDev.jsxs && /*  */ (JsxDev.jsxs = WrapJsx(JsxDev.jsxs))
	JsxPro.jsxs && /*  */ (JsxPro.jsxs = WrapJsx(JsxPro.jsxs))
	JsxDev.jsxDEV && (JsxDev.jsxDEV = WrapJsx(JsxDev.jsxDEV))
	JsxPro.jsxDEV && (JsxPro.jsxDEV = WrapJsx(JsxPro.jsxDEV))
}

let didInstall = false

// We run install now because it needs to happen at init time, before any components are rendered.
// When consumers run `install`, it's a no-op. But it's better DX to have to call a function than simply import
// a module for the side effects.
install()
