# Kubernetes Horizontal Pod Autoscaler (HPA) Lab: Auto Scaling System

This repository contains the complete configuration, load testing scripts, and documentation for implementing a **Horizontal Pod Autoscaler (HPA)** in a Kubernetes environment using Minikube and k6. 

The goal of this project is to build an automated system that dynamically scales application capacity (Pods) up during high traffic spikes and scales down during idle periods to optimize resource utilization.

---

## 🚀 Learning Objectives Learned
- core concepts of Auto Scaling Groups and lifecycle behaviors.
- Setting up Resource Requests and Limits as blueprints for resource allocation.
- Port-forwarding and cluster service access mechanisms.
- Metric-based scaling policies and observation of the cooldown period.
- Executing real-world load testing using `k6`.

---

## 🛠️ Prerequisites
Ensure you have the following tools installed on your local machine:
- **Docker Desktop** (Running)
- **Minikube** & **kubectl**
- **k6** (Load testing tool)

---

## 📋 Step-by-Step Implementation Guide

### Step 1: Environment & Metrics Server Preparation
Kubernetes HPA requires real-time resource utilization metrics (CPU/Memory) to determine when to scale. We use the `metrics-server` addon inside Minikube.

1. Start Minikube using the Docker driver (optimized for local environments without virtualization conflicts):
```bash
minikube start --driver=docker

```

2. Enable the `metrics-server` addon:
```bash
minikube addons enable metrics-server

```


3. Verify that the Metrics Server is active and collecting data (it may take 1-2 minutes to initialize):
```bash
kubectl top nodes

```


*Success Indicator:* The command outputs the current CPU (cores) and Memory (bytes) usage of your Minikube node.

---

### Step 2: Deploy the Application with Resource Limits

To allow HPA to calculate scaling percentages accurately, container manifests **must** define CPU resource requests.

1. Create a file named `app-deployment.yaml` containing a `php-apache` server designed to perform CPU-intensive tasks:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: php-apache
spec:
  replicas: 1
  selector:
    matchLabels:
      run: php-apache
  template:
    metadata:
      labels:
        run: php-apache
    spec:
      containers:
      - name: php-apache
        image: registry.k8s.io/hpa-example
        ports:
        - containerPort: 80
        resources:
          limits:
            cpu: 500m
          requests:
            cpu: 200m
---
apiVersion: v1
kind: Service
metadata:
  name: php-apache
  labels:
    run: php-apache
spec:
  ports:
  - port: 80
  selector:
    run: php-apache

```


2. Apply the manifest to your cluster:
```bash
kubectl apply -f app-deployment.yaml

```


3. Verify that the Pod is successfully created and running:
```bash
kubectl get pods

```



---

### Step 3: Configure the Horizontal Pod Autoscaler (HPA)

The HPA will monitor the deployment and maintain between 1 and 10 replicas. It targets an average CPU utilization of **50%** across all Pods.

1. Create a file named `app-hpa.yaml`:
```yaml
apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  name: php-apache
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: php-apache
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 50

```


2. Deploy the HPA configuration:
```bash
kubectl apply -f app-hpa.yaml

```


3. Check the HPA status:
```bash
kubectl get hpa

```


*Note:* Wait until the `TARGETS` column changes from `<unknown>/50%` to `0%/50%`, indicating that the HPA has successfully bound to the metrics endpoint.

---

### Step 4: Setup Port Forwarding & Load Test Script

Since Minikube runs inside an isolated Docker network, we must expose the service to our local Windows host machine using port forwarding.

1. Open a dedicated terminal window and run:
```bash
kubectl port-forward service/php-apache 8080:80

```


*Keep this terminal running.* The application is now accessible at `http://localhost:8080`.
2. Create the `k6` load test configuration script named `load-test.js`:
```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp-up to 50 Virtual Users (VUs)
    { duration: '3m', target: 50 },  // Stay/Sustain 50 VUs to trigger HPA
    { duration: '1m', target: 0 },   // Ramp-down to 0 users
  ],
};

export default function () {
  http.get('http://localhost:8080');
  sleep(0.1); 
}

```



---

### Step 5: Execution, Observation & Real Test Results

To witness the system scale dynamically, monitor the HPA in one terminal while executing the load test in another.

1. **Terminal 1 (Monitoring):** Start watching the HPA changes live:
```bash
kubectl get hpa php-apache --watch

```


2. **Terminal 2 (Execution):** Execute the load test via k6:
```bash
k6 run load-test.js

```



#### 📊 Real Experiment Metrics & Timeline Analysis

Based on our live test logs, here is the chronological breakdown of the HPA behavior:

| Time (Age) | CPU Utilization | Pod Replicas | System Behavior / State |
| --- | --- | --- | --- |
| **10m** | `0% / 50%` | **1** | **Idle State:** Normal baseline traffic with minimum 1 Pod replica. |
| **11m** | `238% / 50%` | **1 → 4** | **Traffic Spike Detected:** k6 initiates heavy requests. CPU exceeds the 50% threshold drastically to 238%. HPA immediately initializes scale-up lifecycle and spawns 4 Pods. |
| **12m** | `250% / 50%` | **5** | **Peak Load / Stabilization:** Traffic holds at 50 VUs. CPU peaks at 250%. HPA provisions an additional replica, bringing the total to 5 stable Pods to handle the massive load. |
| **13m** | `50% / 50%` | **5** | **Test Completed:** k6 stops traffic execution. Load drops immediately to the 50% target utilization level. |
| **15m** | `50% / 50%` | **5** | **Cooldown Period Active:** The traffic returns to 0%, but Kubernetes intentionally holds the 5 replicas active for a safety margin (cooldown delay) before safely terminating idle containers back to 1. |

---

## 📈 Visual Autoscaling Behavior

The dynamic response of the system—showing the exact correlation between the massive CPU utilization spike and the immediate reactive scale-up of pod counts—is visualized in the graph chart saved inside this repository as `grafik-autoscaling.png`.

*The graph perfectly demonstrates how cloud-native infrastructure ensures high availability during peak traffic while optimizing operational infrastructure costs during downtime.*
