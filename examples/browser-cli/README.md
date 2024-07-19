# browser-cli

```sh
$ pnpm cli
> window.navigator.userAgent
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/127.0.6533.17 Safari/537.36
> self.ReactDom = await import("react-dom");;
undefined
> ReactDom.render(<div>yay</div>, document.body)
ref: <Node>
> document.body.innerHTML
<div>yay</div>
```

## credits

- https://github.com/webdriverio/bx
