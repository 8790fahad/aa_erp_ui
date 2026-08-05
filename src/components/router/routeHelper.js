export const gotoApp = (access, navigate) => {
    let _access = access;
    
    switch (_access[0]) {
      case 'Purchases':
        return navigate('/app/purchase');
      case 'Inventory':
        return navigate('/app/inventory');
      case 'Sales':
        return navigate('/app/sales');
      case 'Reports':
        return navigate('/app/account');
      case 'Production':
        return navigate('/app/production');
      case 'Customers':
        return navigate('/app/customer');
      case 'Admin':
        return navigate('/app/admin');
      default:
        return navigate('/app');
    }
  };
  