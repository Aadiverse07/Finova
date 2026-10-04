import { CustomerProfilePage } from '@/components/customers/customer-module';
export default function CustomerPage({params}:{params:{id:string}}){ return <CustomerProfilePage id={params.id}/>; }
