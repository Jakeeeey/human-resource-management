export interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname?: string | null;
    user_email: string;
    user_contact?: string;
    user_province?: string;
    user_city?: string;
    user_brgy?: string;
}

export interface Salesman {
    id: number;
    employee_id: number;
    salesman_code: string;
    salesman_name: string;
    truck_plate?: string | null;
    division_id?: number | null;
    branch_code?: number | null;
    bad_branch_code?: number | null;
    operation?: number | null;
    company_code?: number | null;
    supplier_code?: number | null;
    price_type?: string | null;
    price_type_id?: number | null;
    isActive?: number | null;
    isInventory?: number | null;
    canCollect?: number | null;
    inventory_day?: number | null;
    modified_date?: string | null;
    encoder_id?: number | null;
}

export interface Division {
    division_id: number;
    division_name: string;
    division_description?: string | null;
    division_code?: string | null;
}

export interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
    branch_description?: string;
    isReturn?: number;
}

export interface Operation {
    id: number;
    operation_code?: string | null;
    operation_name?: string | null;
    definition?: string | null;
}

export interface PriceType {
    price_type_id: number;
    price_type_name: string;
    sort?: number | null;
}

export interface Customer {
    id: number;
    customer_code: string;
    customer_name: string;
    store_name: string;
    store_signage: string;
    city?: string | null;
    province?: string | null;
    brgy?: string | null;
    contact_number: string;
    customer_email?: string | null;
    type: 'Regular' | 'Employee';
    isActive: number;
}

export interface CustomerSalesman {
    id: number;
    customer_id: number;
    salesman_id: number;
}

export interface SalesmanWithRelations extends Salesman {
    employee?: User | null;
    division?: Division | null;
    branch?: Branch | null;
    bad_branch?: Branch | null;
    operation_details?: Operation | null;
    price_type_details?: PriceType | null;
    customers?: Customer[];
}

export interface SalesmanFilters {
    search: string;
    priceType: string;
    isActive: boolean | null;
}

export interface DirectusListResponse<T> {
    data: T[];
}

export interface DirectusSingleResponse<T> {
    data: T;
}
