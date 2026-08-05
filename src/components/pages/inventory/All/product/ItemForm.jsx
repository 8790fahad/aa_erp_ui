// ItemForm.tsx - Main form component for creating/editing items

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardBody,
  CardHeader,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Row,
  Col,
  Collapse,
  InputGroup,
  InputGroupText,
  FormFeedback,
  Alert
} from 'reactstrap';
import { toast } from 'sonner';
import { itemFormSchema, transformFormDataForApi } from './schema';
import { Item, ItemFormData, INCOME_ACCOUNTS, EXPENSE_ACCOUNTS } from './types';
import { itemsApi, generateSKU, uploadImageToCloudinary } from './api';
import PropTypes from 'prop-types';

const ItemForm = ({ item, onSave, onCancel, isLoading = false }) => {
  const [salesCollapsed, setSalesCollapsed] = useState(false);
  const [purchasingCollapsed, setPurchasingCollapsed] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const isEditing = !!item;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: item?.name || '',
      item_type: item?.item_type || 'Service',
      sku: item?.sku || '',
      category: item?.category || '',
      class: item?.class || '',
      image_url: item?.image_url || '',
      sales_enabled: item?.sales_enabled ?? true,
      sales_description: item?.sales_description || '',
      price_rate: item?.price_rate || 0,
      income_account: item?.income_account || 'Sales',
      purchasing_enabled: item?.purchasing_enabled ?? false,
      purchase_description: item?.purchase_description || '',
      purchase_cost: item?.purchase_cost || 0,
      expense_account: item?.expense_account || 'Purchases',
      preferred_supplier: item?.preferred_supplier || ''
    }
  });

  const watchedValues = watch();

  // Load categories and suppliers on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [categoriesData, suppliersData] = await Promise.all([
          itemsApi.getCategories(),
          itemsApi.getSuppliers()
        ]);
        setCategories(categoriesData);
        setSuppliers(suppliersData);
      } catch (error) {
        console.error('Failed to load metadata:', error);
      }
    };

    loadMetadata();
  }, []);

  // Auto-generate SKU when name changes (if SKU is empty)
  useEffect(() => {
    if (watchedValues.name && !watchedValues.sku && !isEditing) {
      const generatedSKU = generateSKU(watchedValues.name);
      setValue('sku', generatedSKU);
    }
  }, [watchedValues.name, watchedValues.sku, isEditing, setValue]);

  // Show/hide sections based on enabled flags
  useEffect(() => {
    setSalesCollapsed(!watchedValues.sales_enabled);
  }, [watchedValues.sales_enabled]);

  useEffect(() => {
    setPurchasingCollapsed(!watchedValues.purchasing_enabled);
  }, [watchedValues.purchasing_enabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 's') {
          event.preventDefault();
          handleSubmit(data => onSubmitForm(data, 'save'))();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          handleSubmit(data => onSubmitForm(data, 'saveAndNew'))();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  const onSubmitForm = async (data, action) => {
    try {
      const transformedData = transformFormDataForApi(data);
      await onSave(transformedData, action);
      
      if (action === 'saveAndNew') {
        toast.success('Item saved! Ready for next item.');
      } else {
        toast.success(isEditing ? 'Item updated successfully!' : 'Item created successfully!');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Failed to save item. Please try again.');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be less than 5MB.');
      return;
    }

    setImageUploading(true);
    try {
      const imageUrl = await uploadImageToCloudinary(file);
      setValue('image_url', imageUrl);
      setShowImagePreview(true);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleCategoryCreate = useCallback((value) => {
    if (value && !categories.includes(value)) {
      setCategories(prev => [...prev, value].sort());
    }
    setValue('category', value);
  }, [categories, setValue]);

  const handleSupplierCreate = useCallback((value) => {
    if (value && !suppliers.includes(value)) {
      setSuppliers(prev => [...prev, value].sort());
    }
    setValue('preferred_supplier', value);
  }, [suppliers, setValue]);

  return (
    <div className="item-form">
      <Card>
        <CardHeader className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            {isEditing ? `Edit Item: ${item.name}` : 'New Item'}
          </h4>
          <div className="text-muted small">
            Use Ctrl+S to save, Ctrl+Enter to save & new
          </div>
        </CardHeader>

        <CardBody>
          <Form onSubmit={handleSubmit(data => onSubmitForm(data, 'save'))}>
            {/* Basic Information */}
            <Card className="mb-4">
              <CardHeader>
                <h5 className="mb-0">Basic Information</h5>
              </CardHeader>
              <CardBody>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="name" className="fw-bold">
                        Name <span className="text-danger">*</span>
                      </Label>
                      <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="name"
                            type="text"
                            placeholder="Enter item name"
                            invalid={!!errors.name}
                            autoFocus
                          />
                        )}
                      />
                      <FormFeedback>{errors.name?.message}</FormFeedback>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="item_type" className="fw-bold">
                        Type <span className="text-danger">*</span>
                      </Label>
                      <Controller
                        name="item_type"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="item_type"
                            type="select"
                            invalid={!!errors.item_type}
                          >
                            <option value="Service">Service</option>
                            <option value="Product">Product</option>
                          </Input>
                        )}
                      />
                      <FormFeedback>{errors.item_type?.message}</FormFeedback>
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="sku" className="fw-bold">SKU</Label>
                      <Controller
                        name="sku"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="sku"
                            type="text"
                            placeholder="Auto-generated if empty"
                            invalid={!!errors.sku}
                          />
                        )}
                      />
                      <FormFeedback>{errors.sku?.message}</FormFeedback>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="category" className="fw-bold">Category</Label>
                      <Controller
                        name="category"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="category"
                            type="select"
                            invalid={!!errors.category}
                            onChange={(e) => {
                              if (e.target.value === '__create_new__') {
                                const newCategory = prompt('Enter new category:');
                                if (newCategory) {
                                  handleCategoryCreate(newCategory);
                                }
                              } else {
                                field.onChange(e);
                              }
                            }}
                          >
                            <option value="">Select or create category</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="__create_new__">+ Create New Category</option>
                          </Input>
                        )}
                      />
                      <FormFeedback>{errors.category?.message}</FormFeedback>
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="class" className="fw-bold">Class</Label>
                      <Controller
                        name="class"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="class"
                            type="text"
                            placeholder="Enter item class"
                            invalid={!!errors.class}
                          />
                        )}
                      />
                      <FormFeedback>{errors.class?.message}</FormFeedback>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="image_upload" className="fw-bold">Image</Label>
                      <div>
                        <Input
                          id="image_upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={imageUploading}
                          className="mb-2"
                        />
                        {imageUploading && (
                          <div className="text-muted small">Uploading image...</div>
                        )}
                        {watchedValues.image_url && (
                          <div className="mt-2">
                            <img
                              src={watchedValues.image_url}
                              alt="Item preview"
                              style={{ maxWidth: '100px', maxHeight: '100px' }}
                              className="img-thumbnail"
                            />
                            <Button
                              color="link"
                              size="sm"
                              onClick={() => setValue('image_url', '')}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormGroup>
                  </Col>
                </Row>
              </CardBody>
            </Card>

            {/* Sales Information */}
            <Card className="mb-4">
              <CardHeader
                className="cursor-pointer"
                onClick={() => {
                  const newValue = !watchedValues.sales_enabled;
                  setValue('sales_enabled', newValue);
                  setSalesCollapsed(!newValue);
                }}
              >
                <div className="d-flex align-items-center">
                  <Input
                    type="checkbox"
                    checked={watchedValues.sales_enabled}
                    onChange={(e) => {
                      setValue('sales_enabled', e.target.checked);
                      setSalesCollapsed(!e.target.checked);
                    }}
                    className="me-2"
                  />
                  <h5 className="mb-0">I sell this item</h5>
                </div>
              </CardHeader>
              <Collapse isOpen={!salesCollapsed}>
                <CardBody>
                  <Row>
                    <Col md={8}>
                      <FormGroup>
                        <Label for="sales_description" className="fw-bold">
                          Sales Description
                        </Label>
                        <Controller
                          name="sales_description"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="sales_description"
                              type="textarea"
                              rows={3}
                              placeholder="Describe this item for sales purposes"
                              invalid={!!errors.sales_description}
                            />
                          )}
                        />
                        <FormFeedback>{errors.sales_description?.message}</FormFeedback>
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <Label for="price_rate" className="fw-bold">
                          Price/Rate
                        </Label>
                        <InputGroup>
                          <InputGroupText>$</InputGroupText>
                          <Controller
                            name="price_rate"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="price_rate"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                invalid={!!errors.price_rate}
                              />
                            )}
                          />
                        </InputGroup>
                        <FormFeedback>{errors.price_rate?.message}</FormFeedback>
                      </FormGroup>
                    </Col>
                  </Row>

                  <FormGroup>
                    <Label for="income_account" className="fw-bold">
                      Income Account
                    </Label>
                    <Controller
                      name="income_account"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="income_account"
                          type="select"
                          invalid={!!errors.income_account}
                        >
                          {INCOME_ACCOUNTS.map(account => (
                            <option key={account.value} value={account.value}>
                              {account.label}
                            </option>
                          ))}
                        </Input>
                      )}
                    />
                    <FormFeedback>{errors.income_account?.message}</FormFeedback>
                  </FormGroup>
                </CardBody>
              </Collapse>
            </Card>

            {/* Purchasing Information */}
            <Card className="mb-4">
              <CardHeader
                className="cursor-pointer"
                onClick={() => {
                  const newValue = !watchedValues.purchasing_enabled;
                  setValue('purchasing_enabled', newValue);
                  setPurchasingCollapsed(!newValue);
                }}
              >
                <div className="d-flex align-items-center">
                  <Input
                    type="checkbox"
                    checked={watchedValues.purchasing_enabled}
                    onChange={(e) => {
                      setValue('purchasing_enabled', e.target.checked);
                      setPurchasingCollapsed(!e.target.checked);
                    }}
                    className="me-2"
                  />
                  <h5 className="mb-0">I purchase this item</h5>
                </div>
              </CardHeader>
              <Collapse isOpen={!purchasingCollapsed}>
                <CardBody>
                  <Row>
                    <Col md={8}>
                      <FormGroup>
                        <Label for="purchase_description" className="fw-bold">
                          Purchase Description
                        </Label>
                        <Controller
                          name="purchase_description"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="purchase_description"
                              type="textarea"
                              rows={3}
                              placeholder="Describe this item for purchasing purposes"
                              invalid={!!errors.purchase_description}
                            />
                          )}
                        />
                        <FormFeedback>{errors.purchase_description?.message}</FormFeedback>
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <Label for="purchase_cost" className="fw-bold">
                          Purchase Cost
                        </Label>
                        <InputGroup>
                          <InputGroupText>$</InputGroupText>
                          <Controller
                            name="purchase_cost"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="purchase_cost"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                invalid={!!errors.purchase_cost}
                              />
                            )}
                          />
                        </InputGroup>
                        <FormFeedback>{errors.purchase_cost?.message}</FormFeedback>
                      </FormGroup>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <FormGroup>
                        <Label for="expense_account" className="fw-bold">
                          Expense Account
                        </Label>
                        <Controller
                          name="expense_account"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="expense_account"
                              type="select"
                              invalid={!!errors.expense_account}
                            >
                              {EXPENSE_ACCOUNTS.map(account => (
                                <option key={account.value} value={account.value}>
                                  {account.label}
                                </option>
                              ))}
                            </Input>
                          )}
                        />
                        <FormFeedback>{errors.expense_account?.message}</FormFeedback>
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup>
                        <Label for="preferred_supplier" className="fw-bold">
                          Preferred Supplier
                        </Label>
                        <Controller
                          name="preferred_supplier"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="preferred_supplier"
                              type="select"
                              invalid={!!errors.preferred_supplier}
                              onChange={(e) => {
                                if (e.target.value === '__create_new__') {
                                  const newSupplier = prompt('Enter new supplier:');
                                  if (newSupplier) {
                                    handleSupplierCreate(newSupplier);
                                  }
                                } else {
                                  field.onChange(e);
                                }
                              }}
                            >
                              <option value="">Select or create supplier</option>
                              {suppliers.map(supplier => (
                                <option key={supplier} value={supplier}>
                                  {supplier}
                                </option>
                              ))}
                              <option value="__create_new__">+ Create New Supplier</option>
                            </Input>
                          )}
                        />
                        <FormFeedback>{errors.preferred_supplier?.message}</FormFeedback>
                      </FormGroup>
                    </Col>
                  </Row>
                </CardBody>
              </Collapse>
            </Card>

            {/* Form Actions */}
            <div className="d-flex justify-content-between align-items-center">
              <div>
                {isDirty && (
                  <Alert color="info" className="mb-0 me-3" style={{ padding: '0.5rem' }}>
                    You have unsaved changes
                  </Alert>
                )}
              </div>
              <div className="d-flex gap-2">
                <Button
                  color="secondary"
                  onClick={onCancel}
                  disabled={isSubmitting || isLoading}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  outline
                  onClick={handleSubmit(data => onSubmitForm(data, 'saveAndNew'))}
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting ? 'Saving...' : 'Save & New'}
                </Button>
                <Button
                  color="primary"
                  type="submit"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting ? 'Saving...' : 'Save & Close'}
                </Button>
              </div>
            </div>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
};

ItemForm.propTypes = {
  item: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool
};

export default ItemForm;