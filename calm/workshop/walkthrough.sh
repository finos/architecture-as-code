#!/bin/bash

export BAT_THEME="zenburn"

# ANSI color codes
YELLOW='\033[0;33m'
YELLOW_BOLD='\033[1;33m'
RED='\033[0;31m'
# Reset color
NC='\033[0m'

heading() {
    clear
    local text=$1
    echo -e "${YELLOW_BOLD}${text}${NC}\n"
}

info() {
    local text=$1
    echo -e "${YELLOW}${text}${NC}\n"
}

error() {
    local text=$1
    echo -e "${RED}${text}\033[0m\n"
}

success() {
    local text=$1
    echo -e "\033[1;32m${text}\033[0m\n"
}

command() {
    local text=$1
    echo -e "\033[0;32m> ${text}\033[0m\n"
}

heading "Preparing the environment for the demo..."
info "Destroy Previous Deployments"...
minikube stop --profile insecure
minikube stop --profile secure

cd insecure-example/cluster
command "Starting Minikube..."
./cluster_start.sh
command "Deploying Handcrafted Architecture"
cd ../kubernetes
kubectl apply -k .

heading "Browser Demo"
info "Let's take a look"
error "Start Minikube Tunnel"

success "Let's verify the environment"
read
command "kubectl get pods -n conference"
kubectl get pods -n conference
read
command "kubectl get services -n conference"
kubectl get services -n conference
read
command "kubectl -n conference run -it --rm --image=nicolaka/netshoot test-pod -- bash"
kubectl -n conference run -it --rm --image=nicolaka/netshoot test-pod -- bash

read
info "It's very broken, lets go back to the slides - and look at a possible approach"
minikube stop --profile insecure
read

kubectl delete -k .
cd ../../

#Show the CALM CLI commands

heading "Using CALM CLI"
command "calm"
calm
read

#Look at a pattern file
heading "Patterns and Controls"
info "Let's look at a pattern file"
read
bat conference-secure-signup.pattern.json --line-range 80:113 --line-range 162:200 --line-range 290:329 --highlight-line 101:106 --highlight-line 192:200 --highlight-line 311:329

info "Let's look at the Kubernetes cluster control requirement"
read
bat controls/micro-segmentation.requirement.json --line-range 0:35 --highlight-line 21:26
info "Let's look at the control configuration"
read
bat controls/micro-segmentation.config.json --line-range 0:9 --highlight-line 7:8
info "Let's look at a control requirement to permit a connection"
read
bat controls/permitted-connection.requirement.json --line-range 12:27 --highlight-line 21:27
info "Let's look at the basic configuration"
read
bat controls/permitted-connection-http.config.json --line-range 0:8 --highlight-line 6:7
read

#Generate an Architecture
heading "Generating an architecture"
command "calm generate -p conference-secure-signup.pattern.json -o architecture.json"
calm generate -p conference-secure-signup.pattern.json -o architecture.json
read
info "Let's look at the architecture"
bat architecture.json --line-range 29:42 --line-range 61:72 --line-range 106:127 --highlight-line 34:37 --highlight-line 70:71 --highlight-line 124:125
read

#Run a Validate
heading "Validating an Architecture"
read
command "calm validate -p conference-secure-signup.pattern.json -a architecture.json"
calm validate -p conference-secure-signup.pattern.json -a architecture.json
read

#Show Placeholders, fill placeholders
heading "Populating Architectures"
info "Here's one I made earlier..."
bat architecture/conference-secure-signup-amended.arch.json --line-range 29:41 --highlight-line 34:37

read
info "Template Bundle Directory"
tree secure-infra-template-bundle
read


#Generate an architecture
bat secure-infra-template-bundle/application-deployment.yaml --highlight-line 16:19
read

heading "Creating a Kubernetes Deployment"
command "calm template \
           --input architecture/conference-secure-signup-amended.arch.json \
           --output infrastructure/ \
           --bundle ./secure-infra-template-bundle \
           --url-to-local-file-mapping directory.json"

calm template \
           --input architecture/conference-secure-signup-amended.arch.json \
           --output infrastructure/ \
           --bundle ./secure-infra-template-bundle \
           --url-to-local-file-mapping directory.json
read

heading "Looking at the generated content"
info "1) Cluster Setup"
bat infrastructure/cluster/cluster_start.sh --line-range 0:13 --highlight-line 10 --highlight-line 13
read
info "2) Kubernetes Deployment"
bat infrastructure/kubernetes/application-deployment.yaml --line-range 0:19
read
info "3) Controls Applied"
bat infrastructure/kubernetes/permit-lb-to-app.yaml --line-range 0:12

#Start the Cluster
chmod 755 infrastructure/cluster/cluster_start.sh
infrastructure/cluster/cluster_start.sh

#Deploy the Application
command "kubectl apply -k infrastructure/kubernetes"
kubectl apply -k infrastructure/kubernetes
read

heading "Lets re-assess the previous vulnerability"
command "kubectl -n conference run -it --rm --image=nicolaka/netshoot test-pod -- bash"
kubectl -n conference run -it --rm --image=nicolaka/netshoot test-pod -- bash
read
info "Let's verify the website is still working"
error "Reset Minikube Tunnel"
read

#Show CalmHub
heading "This is a lot of JSON and YAML"
info "Let's take a look at CalmHub"
read

#Show Docify (pre-canned)
heading "CALM Docify Demo"
command "calm docify --input architecture/conference-secure-signup-amended.arch.json --output website --url-to-local-file-mapping directory.json"
command "cd website"
command "npm install"
command "npm run start"
read
cd website
npm run start
read

#Cleanup
command "Clean Up, Time for a drink"
read
cd ..
rm -rf infrastructure
rm architecture.json
minikube stop --profile secure
kubectl delete -k infrastructure/kubernetes