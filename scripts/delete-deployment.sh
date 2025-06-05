#!/bin/bash
# delete-deployment.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS] DEPLOYMENT_NAME"
    echo ""
    echo "Delete specific Kubernetes deployment"
    echo ""
    echo "Options:"
    echo "  -n, --namespace NAMESPACE    Specify namespace (default: warely)"
    echo "  -a, --all                    Delete all deployments in namespace"
    echo "  -f, --force                  Force delete without confirmation"
    echo "  -s, --service                Also delete associated service"
    echo "  -p, --pvc                    Also delete associated PVC"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backend                   Delete backend deployment in warely namespace"
    echo "  $0 -n default nginx          Delete nginx deployment in default namespace"
    echo "  $0 -a                        Delete all deployments in warely namespace"
    echo "  $0 -s -p mongodb             Delete mongodb deployment, service, and PVC"
    echo "  $0 -f backend                Force delete backend without confirmation"
}

# Default values
NAMESPACE="warely"
DEPLOYMENT_NAME=""
DELETE_ALL=false
FORCE=false
DELETE_SERVICE=false
DELETE_PVC=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -a|--all)
            DELETE_ALL=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -s|--service)
            DELETE_SERVICE=true
            shift
            ;;
        -p|--pvc)
            DELETE_PVC=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*|--*)
            print_error "Unknown option $1"
            usage
            exit 1
            ;;
        *)
            DEPLOYMENT_NAME="$1"
            shift
            ;;
    esac
done

# Validate input
if [[ "$DELETE_ALL" == false && -z "$DEPLOYMENT_NAME" ]]; then
    print_error "Deployment name is required unless using --all option"
    usage
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    print_error "Namespace '$NAMESPACE' does not exist"
    exit 1
fi

# Function to confirm deletion
confirm_deletion() {
    local resource="$1"
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    echo -n "Are you sure you want to delete $resource? (y/N): "
    read -r response
    case "$response" in
        [yY]|[yY][eE][sS])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to delete deployment
delete_deployment() {
    local dep_name="$1"
    
    print_status "Checking if deployment '$dep_name' exists in namespace '$NAMESPACE'..."
    
    if ! kubectl get deployment "$dep_name" -n "$NAMESPACE" &> /dev/null; then
        print_warning "Deployment '$dep_name' not found in namespace '$NAMESPACE'"
        return 1
    fi
    
    if confirm_deletion "deployment '$dep_name'"; then
        print_status "Deleting deployment '$dep_name'..."
        kubectl delete deployment "$dep_name" -n "$NAMESPACE"
        print_success "Deployment '$dep_name' deleted successfully"
        
        # Wait for pods to be terminated
        print_status "Waiting for pods to be terminated..."
        kubectl wait --for=delete pod -l app="$dep_name" -n "$NAMESPACE" --timeout=60s || true
        
        return 0
    else
        print_warning "Deletion of deployment '$dep_name' cancelled"
        return 1
    fi
}

# Function to delete service
delete_service() {
    local svc_name="$1"
    
    if kubectl get service "$svc_name" -n "$NAMESPACE" &> /dev/null; then
        if confirm_deletion "service '$svc_name'"; then
            print_status "Deleting service '$svc_name'..."
            kubectl delete service "$svc_name" -n "$NAMESPACE"
            print_success "Service '$svc_name' deleted successfully"
        fi
    else
        print_warning "Service '$svc_name' not found"
    fi
}

# Function to delete PVC
delete_pvc() {
    local pvc_name="$1"
    
    if kubectl get pvc "$pvc_name" -n "$NAMESPACE" &> /dev/null; then
        if confirm_deletion "PVC '$pvc_name'"; then
            print_status "Deleting PVC '$pvc_name'..."
            kubectl delete pvc "$pvc_name" -n "$NAMESPACE"
            print_success "PVC '$pvc_name' deleted successfully"
        fi
    else
        print_warning "PVC '$pvc_name' not found"
    fi
}

# Main execution
if [[ "$DELETE_ALL" == true ]]; then
    print_status "Getting all deployments in namespace '$NAMESPACE'..."
    DEPLOYMENTS=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$DEPLOYMENTS" ]]; then
        print_warning "No deployments found in namespace '$NAMESPACE'"
        exit 0
    fi
    
    echo "Found deployments: $DEPLOYMENTS"
    
    if confirm_deletion "ALL deployments in namespace '$NAMESPACE'"; then
        for dep in $DEPLOYMENTS; do
            delete_deployment "$dep"
        done
    else
        print_warning "Deletion cancelled"
        exit 0
    fi
else
    # Delete specific deployment
    if delete_deployment "$DEPLOYMENT_NAME"; then
        # Delete associated service if requested
        if [[ "$DELETE_SERVICE" == true ]]; then
            delete_service "$DEPLOYMENT_NAME"
        fi
        
        # Delete associated PVC if requested
        if [[ "$DELETE_PVC" == true ]]; then
            delete_pvc "${DEPLOYMENT_NAME}-pvc"
        fi
    fi
fi

print_status "Checking remaining resources in namespace '$NAMESPACE'..."
kubectl get deployments,services,pods -n "$NAMESPACE"

print_success "Operation completed!"