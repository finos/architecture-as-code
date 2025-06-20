# CALM Demo: Conference Signup

This demo showcases the **CALM ** approach in action. Designed to help you get started with CALM. 

## 💡 What You'll Learn

- How to apply reusable architectural patterns with CALM
- How to go from architecture to docifying your architecture
- How you can use calm-hub to store all your CALM architecture artifacts.

---

## 🚀 Prerequisites

Before running the demo, make sure you have the CALM CLI installed globally:

```shell
npm install -g @finos/calm-cli
```

Verify the installation. 

```shell
calm -V
```

This getting started has been verified to work against 0.7.7 of the cli.

---

## 🛠️ Step-by-Step Demo

Assuming you're in the `calm/getting-started` directory:


## 📁 Folder Structure

You should see this to begin with..

```
calm/
└── getting-started/
    ├── conference-signup.pattern.json
    ├── controls/
    │   ├── micro-segmentation.config.json
    │   ├── micro-segmentation.requirement.json
    │   ├── permitted-connection.requirement.json
    │   ├── permitted-connection-http.config.json
    │   └── permitted-connection-jdbc.config.json
├── README.md
```


### **Step 1: Generate an Architecture Instantiation**

Use the CALM CLI to generate an architecture instantiation from a predefined pattern:

```shell
calm generate \
  --pattern conference-signup.pattern.json \
  --output conference-signup.arch.json
```

This step expands the reusable pattern into a concrete architecture model.

```
calm/
└── getting-started/
    ├── conference-signup.arch.json (*newly instantiated architecture*)

```


---

### **Step 2: Generate Docify Website**

Looking at JSON is never easy. Wouldn't it be cool to be able to view documentation your architecture in a human readbale form?
Use the CALM CLI to generate a docify website from your architecture instantiation:

```shell
calm docify \
  --input conference-signup.arch.json \
  --output website
```

Now let's navigate to the generated output and run up our documentation website.

```shell
cd website
npm install 
npm start
```

TODO: INSERT IMAGE OF SUCCESS

### **Step 3: Run up your local calm-hub

TODO: Add background to what calm-hub is 

```shell
cd ../../calm-hub

# Development mode with standalone storage
../mvnw quarkus:dev -Dcalm.database.mode=standalone

# Production mode with standalone storage
java -Dcalm.database.mode=standalone -jar target/quarkus-app/quarkus-run.jar
```

Now let's hydrate our calm-hub with some calm documents you are managing.

```shell
# Hydate calm-hub
../../calm-hub/nitrite/init-nitrite.sh
```

TODO: Add screenshot of populated calm-hub


### ** Step 4: Visualising on calm-hub

TODO

### ** Step 5: Showing Flows Through Your architecture**

Often there could be multiple different functional flows that go through architecture components. We have provided one for you that on your calm-hub here

TODO: Add URL

Add this to the top level of your generated conference-signup.arch.json document
```json
"metadata": [
{ 
   "kubernetes": {
      "namespace": "conference"
   }
}],
"flows": [
  "calm-hub-url"
]
```
Regenerate your docify website

```bash
calm docify \
  --input conference-signup.arch.json \
  --output website-with-flow
  
```

This step has now created your documentation website with visuals on your flows.

Navigate to the new website folder

```bash
cd website-with-flow
npm install 
npm start
```

You should now see your documentation website with new flow

TODO: Add screenshot

