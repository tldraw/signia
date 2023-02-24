const { wrapJsx } = require('signia-react')
const { Fragment, jsx, jsxs } = require('react/jsx-runtime')

module.exports = {
	Fragment,
	jsx: wrapJsx(jsx),
	jsxs: wrapJsx(jsxs),
}
