import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { _fetchApi } from '@/redux/actions/api';
import moment from 'moment';
import { toast } from 'sonner';

import {
  Container,
  Row,
  Col,
  Input,
  Label,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Badge,
  Pagination,
  PaginationItem,
  PaginationLink,
  Modal,
  ModalBody,
  ModalHeader,
  Table
} from 'reactstrap';

import CustomCard from '@/common/Custom/CustomCard2';
import CustomButton from '@/common/Custom/CustomButton';
import CustomTable1 from '@/common/Custom/CustomTable1';
import Loading from '@/common/Custom/Loading';
import { Eye, List, Grid3x3, Plus, Package } from 'lucide-react';
import { Button as UIButton } from '@/components/ui/button';

export default function ManufacturingProduction() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'
  const [productionRecords, setProductionRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);
  const [dateRange, setDateRange] = useState({
    startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD')
  });
  const [modal, setModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const toggleModal = () => setModal(!modal);

  const viewItemDetails = (item) => {
    setSelectedItem(item);
    toggleModal();
  };

  const fetchProductionRecords = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/api/production/records?facilityId=${activeBusiness.id}&page=${currentPage}&limit=${itemsPerPage}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setProductionRecords(resp.data.productionRecords || []);
          setTotalPages(resp.data.pagination?.totalPages || 1);
        } else {
          toast.error('Failed to load production records');
        }
      },
      (err) => {
        setLoading(false);
        console.error('API Error:', err);
        toast.error('Error fetching production records');
      }
    );
  }, [activeBusiness.id, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchProductionRecords();
  }, [fetchProductionRecords]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'primary';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  };

  const filteredRecords = productionRecords.filter((record) =>
    searchTerm
      ? record.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.requisition_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.branch?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  // List View Columns
  const listViewFields = [
    {
      value: 'created_at',
      title: 'Date',
      custom: true,
      className: 'text-center',
      component: (item) => (
        <div className="text-sm">
          {moment(item.created_at).format('YYYY-MM-DD')}
        </div>
      ),
    },
    {
      value: 'product_name',
      title: 'Product Name',
      custom: true,
      className: 'text-left',
      component: (item) => (
        <div>
          <div className="font-medium">{item.product_name}</div>
          <div className="text-xs text-muted">Batch: {item.batch_no}</div>
        </div>
      ),
    },
    {
      value: 'quantity',
      title: 'Quantity',
      custom: true,
      className: 'text-center',
      component: (item) => (
        <div className="text-sm">
          {Number(item.quantity).toLocaleString()}
        </div>
      ),
    },
    {
      value: 'status',
      title: 'Status',
      custom: true,
      className: 'text-center',
      component: (item) => (
        <div className="flex justify-center">
          <Badge color={getStatusColor(item.status)}>
            {item.status}
          </Badge>
        </div>
      ),
    },
    {
      value: 'total_cost',
      title: 'Cost',
      custom: true,
      className: 'text-right',
      component: (item) => (
        <div className="text-sm font-semibold">
          {Number(item.total_cost || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </div>
      ),
    },
    {
      value: 'action',
      title: 'Action',
      custom: true,
      className: 'text-center',
      component: (item) => (
        <div className="flex justify-center">
          <UIButton
            variant="ghost"
            size="sm"
            onClick={() => viewItemDetails(item)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </UIButton>
        </div>
      ),
    }
  ];

  // Card View Component
  const CardView = () => {
    if (filteredRecords.length === 0) {
      return (
        <div className="text-center py-5">
          <p className="text-muted">No production records found</p>
        </div>
      );
    }

    return (
      <Row>
        {filteredRecords.map((record) => (
          <Col md={6} lg={4} xl={3} key={record.id} className="mb-4">
            <Card className="h-100 shadow-sm">
              <CardHeader className="bg-light">
                <div className="d-flex justify-content-between align-items-start">
                  <CardTitle tag="h6" className="mb-0">
                    {record.product_name}
                  </CardTitle>
                  <Badge color={getStatusColor(record.status)}>
                    {record.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="mb-2">
                  <small className="text-muted">Batch:</small>
                  <div className="fw-bold">{record.batch_no}</div>
                </div>

                <div className="mb-2">
                  <small className="text-muted">Quantity:</small>
                  <div className="fw-bold">{Number(record.quantity).toLocaleString()}</div>
                </div>

                <div className="mb-2">
                  <small className="text-muted">Date:</small>
                  <div>{moment(record.created_at).format('YYYY-MM-DD')}</div>
                </div>

                <div className="mb-3">
                  <small className="text-muted">Total Cost:</small>
                  <div className="fw-bold">
                    {Number(record.total_cost || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                </div>

                <div className="d-flex justify-content-center">
                  <CustomButton
                    size="sm"
                    color="info"
                    onClick={() => viewItemDetails(record)}
                  >
                    <Eye size={14} className="me-1" />
                    View Details
                  </CustomButton>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    return (
      <Pagination className="justify-content-center mt-3 mb-0">
        <PaginationItem disabled={currentPage === 1}>
          <PaginationLink
            previous
            onClick={() => handlePageChange(currentPage - 1)}
          />
        </PaginationItem>

        {pages.map(page => (
          <PaginationItem key={page} active={page === currentPage}>
            <PaginationLink onClick={() => handlePageChange(page)}>
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}

        <PaginationItem disabled={currentPage === totalPages}>
          <PaginationLink
            next
            onClick={() => handlePageChange(currentPage + 1)}
          />
        </PaginationItem>
      </Pagination>
    );
  };

  return (
    <Container fluid>
      <CustomCard
        header={
          <div className="d-flex justify-content-between align-items-center">
            <span>Manufacturing Production Records</span>
            <CustomButton
              size="sm"
              color="primary"
              onClick={() => navigate('/app/production/manufacturing/record/new')}
            >
              <Plus size={14} className="me-1" />
              Record Production
            </CustomButton>
          </div>
        }
      >
        <CardBody>
          <div className="mb-3">
            <Row className="align-items-end">
              <Col md={3}>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                />
              </Col>
              <Col md={3}>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                />
              </Col>
              <Col md={4}>
                <Label>Search</Label>
                <Input
                  type="text"
                  placeholder="Search by product name or batch..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </Col>
              <Col md={2}>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    color={viewMode === 'list' ? 'primary' : 'secondary'}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    <List size={16} />
                  </Button>
                  <Button
                    size="sm"
                    color={viewMode === 'card' ? 'primary' : 'secondary'}
                    onClick={() => setViewMode('card')}
                    title="Card View"
                  >
                    <Grid3x3 size={16} />
                  </Button>
                </div>
              </Col>
            </Row>
          </div>

          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <Loading />
            </div>
          ) : (
            <>
              {viewMode === 'list' ? (
                <CustomTable1
                  data={filteredRecords}
                  fields={listViewFields}
                  loading={loading}
                  pageSize={itemsPerPage}
                  message="No production records found"
                />
              ) : (
                <>
                  <CardView />
                  {renderPagination()}
                </>
              )}
            </>
          )}

          {!loading && filteredRecords.length === 0 && !loading && (
            <div className="text-center py-5">
              <div className="mb-3">
                <Package className="h-12 w-12 text-muted mx-auto" />
              </div>
              <h5>No Production Records Found</h5>
              <p className="text-muted">
                There are no production records matching your current filters.
              </p>
              <CustomButton
                color="primary"
                onClick={() => navigate('/app/production/manufacturing/record/new')}
              >
                <Plus className="me-1" />
                Record New Production
              </CustomButton>
            </div>
          )}
        </CardBody>
      </CustomCard>

      {/* Item Details Modal */}
      <Modal isOpen={modal} toggle={toggleModal} size="xl">
        <ModalHeader toggle={toggleModal}>
          <FaBoxOpen className="me-2" />
          Production Record Details
        </ModalHeader>
        <ModalBody>
          {selectedItem && (
            <div>
              <Row>
                <Col md={6}>
                  <p><strong>Product Name:</strong> {selectedItem.product_name}</p>
                  <p><strong>Batch Number:</strong> {selectedItem.batch_no}</p>
                  <p><strong>Production Date:</strong> {moment(selectedItem.created_at).format('YYYY-MM-DD')}</p>
                  <p><strong>Production Line:</strong> {selectedItem.production_line || 'N/A'}</p>
                </Col>
                <Col md={6}>
                  <p><strong>Quantity Produced:</strong> {Number(selectedItem.quantity).toLocaleString()}</p>
                  <p><strong>Status:</strong>
                    <Badge color={getStatusColor(selectedItem.status)} className="ms-2">
                      {selectedItem.status}
                    </Badge>
                  </p>
                  <p><strong>Total Cost:</strong>
                    {Number(selectedItem.total_cost || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <p><strong>Created By:</strong> {selectedItem.creator_name || 'N/A'}</p>
                </Col>
              </Row>

              <div className="mt-4">
                <h5>Additional Information</h5>
                <Table responsive striped>
                  <tbody>
                    <tr>
                      <td><strong>Notes:</strong></td>
                      <td>{selectedItem.notes || 'No notes provided'}</td>
                    </tr>
                    <tr>
                      <td><strong>Facility:</strong></td>
                      <td>{selectedItem.facility?.business_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td><strong>Last Updated:</strong></td>
                      <td>{moment(selectedItem.updated_at).format('YYYY-MM-DD HH:mm:ss')}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>

              <div className="mt-4">
                <h5>Related Items</h5>
                <div className="alert alert-info">
                  <p className="mb-0">
                    <FaBoxes className="me-2" />
                    This section would show related finished goods and WIP items used in this production.
                  </p>
                </div>
              </div>
            </div>
          )}
        </ModalBody>
      </Modal>
    </Container>
  );
}
