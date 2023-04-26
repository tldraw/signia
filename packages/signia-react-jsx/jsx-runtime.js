import { wrapJsx } from 'signia-react'
import { Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime'

export { Fragment }
export const jsx = wrapJsx(_jsx)
export const jsxs = wrapJsx(_jsxs)