"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[976],{619:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>a,default:()=>h,frontMatter:()=>o,metadata:()=>r,toc:()=>l});var s=n(4848),i=n(8453);const o={sidebar_position:1,slug:"/"},a="Introduction",r={id:"intro",title:"Introduction",description:"The Architecture as Code community publishes and maintains the Common Architecture Language Model (CALM) Manifest and related capabilities, which are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system.",source:"@site/docs/intro.md",sourceDirName:".",slug:"/",permalink:"/architecture-as-code/",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,slug:"/"},sidebar:"docsSidebar",next:{title:"CALM Core",permalink:"/architecture-as-code/calm-core"}},c={},l=[{value:"Fast Track",id:"fast-track",level:2},{value:"Keep CALM and Model Your Architecture",id:"keep-calm-and-model-your-architecture",level:3},{value:"Nodes",id:"nodes",level:3},{value:"Relationships",id:"relationships",level:3},{value:"Capabilities",id:"capabilities",level:3}];function d(e){const t={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",p:"p",pre:"pre",strong:"strong",...(0,i.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.header,{children:(0,s.jsx)(t.h1,{id:"introduction",children:"Introduction"})}),"\n",(0,s.jsxs)(t.p,{children:["The ",(0,s.jsx)(t.strong,{children:"Architecture as Code"})," community publishes and maintains the ",(0,s.jsx)(t.strong,{children:"Common Architecture Language Model (CALM) Manifest"})," and related capabilities, which are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system."]}),"\n",(0,s.jsx)(t.p,{children:"But more than that, our capabilities enable you to bring your architecture to life, by generating code and documentation and by providing tools to ensure that what you said you'd build is what you actually built."}),"\n",(0,s.jsx)(t.h2,{id:"fast-track",children:"Fast Track"}),"\n",(0,s.jsxs)(t.p,{children:["Understand Architecture as Code in ",(0,s.jsx)(t.strong,{children:"5 minutes"}),":"]}),"\n",(0,s.jsx)(t.h3,{id:"keep-calm-and-model-your-architecture",children:"Keep CALM and Model Your Architecture"}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.strong,{children:"CALM"})," is a collection of JSON Schemas that enable you to model your system architecture in a structured way. The core schema is very simple and consists of just 2 collections of elements ",(0,s.jsx)(t.strong,{children:"nodes"})," and ",(0,s.jsx)(t.strong,{children:"relationships"}),"."]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-js",metastring:"showLineNumbers",children:'{\n  "nodes": [],\n  "relationships": []\n}\n'})}),"\n",(0,s.jsx)(t.h3,{id:"nodes",children:"Nodes"}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.strong,{children:"Nodes"})," tell us what the system is made of."]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-js",metastring:"showLineNumbers",children:'{\n  "nodes": [\n    {\n      "uniqueId": "web-client",\n      "type": "webclient",\n      "name": "Web Client",\n      "description": "Browser based web interface",\n      "data-classification": "Confidential",\n      "run-as": "user"\n    },\n    {\n      "uniqueId": "some-service",\n      "type": "service",\n      "name": "An Important Service",\n      "description": "Server process which does something fascinating",\n      "data-classification": "Confidential",\n      "run-as": "systemId"\n    }\n  ]\n}\n'})}),"\n",(0,s.jsxs)(t.p,{children:["You will notice that there is no structure applied in the ",(0,s.jsx)(t.strong,{children:"nodes"})," collection, it purely lists out anything you may consider drawing as a 'box' in a traditional architecture diagram. That includes people, systems, networks, services, databases, etc. which may be at different logical levels in your architecture."]}),"\n",(0,s.jsx)(t.p,{children:"Depending on the type of node the schema requires different attributes to be specified to ensure we have captured appropriate information about the node."}),"\n",(0,s.jsx)(t.h3,{id:"relationships",children:"Relationships"}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.strong,{children:"Relationships"})," tell us how those things are connected."]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-js",metastring:"showLineNumbers",children:'{\n  "relationships": [\n    {\n      "uniqueId": "web-client-uses-some-service",\n      "type": "connects",\n      "parties": {\n        "source": "web-client",\n        "destination": "some-service"\n      },\n      "protocol": "HTTPS",\n      "authentication": "OAuth2"\n    }\n  ]\n}\n'})}),"\n",(0,s.jsxs)(t.p,{children:["It is the ",(0,s.jsx)(t.strong,{children:"relationships"})," which add the context and enable us to connect nodes or encapsulate one or more nodes within another. Depending on the type of relationship the schema requires different attributes to be set, as with the nodes, these additional details help us to enable the capabilities we build which make the model so useful."]}),"\n",(0,s.jsx)(t.p,{children:"Having such a simple core schema may seem limiting, but it's actually very powerful. Having no set hierarchy enforced by the structure of the schema means we can model arbitrarily complex systems and capture multiple views of the same system in a single model. This makes it a lot easier to model real world applications rather than idealised ones."}),"\n",(0,s.jsxs)(t.p,{children:["What you have seen here is just the beginning and shows you just the core schema which is deliberately kept simple. To see more about how you can make use of the ",(0,s.jsx)(t.strong,{children:"CALM"})," Manifest and it's supplementary domains see the ",(0,s.jsx)(t.a,{href:"calm-core/",children:"CALM"})," section."]}),"\n",(0,s.jsx)(t.h3,{id:"capabilities",children:"Capabilities"}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.strong,{children:"Capabilities"})," are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system but also to provide the ability to bootstrap and extend you development work, perform drift detection and more."]}),"\n",(0,s.jsxs)(t.p,{children:["We are just beginning to build the initial capabilities based on CALM so please come back soon to see what's happening or join the ",(0,s.jsx)(t.a,{href:"https://devops.finos.org/docs/home#mailing-list",children:"DevOps Automation Mailing List"})," to be sent notifations of new releases."]})]})}function h(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(d,{...e})}):d(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>a,x:()=>r});var s=n(6540);const i={},o=s.createContext(i);function a(e){const t=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),s.createElement(o.Provider,{value:t},e.children)}}}]);