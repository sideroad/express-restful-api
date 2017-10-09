
/**
 * @api {get} /api/companies/:id Get instance
 * @apiName CompanyGetInstance
 * @apiGroup Company
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiSuccess {String} id 
 * @apiSuccess {String} name 
 * @apiSuccess {Object} members linking of person
 * @apiSuccess {Object} president linking of person
 * @apiSuccess {String} location 
 * @apiSuccess {Boolean} isStockListing 
 * @apiSuccess {String} createdAt 
 * @apiSuccess {String} updatedAt 
 * 
 */

/**
 * @api {get} /api/companies Get collection
 * @apiName CompanyGetCollection
 * @apiGroup Company
 * @apiParam {String} [name]  
 * 
 * @apiParam {String} [president]  person id
 * @apiParam {String} [location]  
 * @apiParam {Boolean} [isStockListing]  
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiParam {String} [expands] Expand specified `parent`, `instance` fields.
 * `children` field could not expanded.
 * @apiParam {String} [orderBy] Specify sort order of fetched collection.
 * For example `orderBy=+name,-age`
 * @apiSuccess {Number} offset
 * @apiSuccess {Number} limit
 * @apiSuccess {Number} size
 * @apiSuccess {String} first
 * @apiSuccess {String} last
 * @apiSuccess {String} prev
 * @apiSuccess {String} next
 * @apiSuccess {Object[]} items Array of Company instance
 * 
 */

/**
 * @api {get} /api/companies Get JSON Schema
 * @apiName CompanyGetJSONSchema
 * @apiGroup Company
 * 
 * 
 * @apiHeader {String} X-JSON-Schema When the header has <code>true</code>, response JSON Schema instead
 */

/**
 * @api {get} /api/companies/:id/members Get members collection
 * @apiName CompanyGetMembersCollection
 * @apiGroup Company
 * @apiParam {String} [name]  
 * 
 * @apiParam {String} [president]  person id
 * @apiParam {String} [location]  
 * @apiParam {Boolean} [isStockListing]  
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiParam {String} [expands] Expand specified `parent`, `instance` fields.
 * `children` field could not expanded.
 * @apiParam {String} [orderBy] Specify sort order of fetched collection.
 * For example `orderBy=+name,-age`
 * @apiSuccess {Number} offset
 * @apiSuccess {Number} limit
 * @apiSuccess {Number} size
 * @apiSuccess {String} first
 * @apiSuccess {String} last
 * @apiSuccess {String} prev
 * @apiSuccess {String} next
 * @apiSuccess {Object[]} items Array of Company instance
 * 
 */

/**
 * @api {delete} /api/companies/:id Delete instance
 * @apiName CompanyDeleteInstance
 * @apiGroup Company
 * 
 * 
 * 
 */

/**
 * @api {post} /api/companies/:id Update instance
 * @apiName CompanyUpdateInstance
 * @apiGroup Company
 * @apiParam {String} [name]  
 * 
 * @apiParam {String} [president]  person id
 * @apiParam {String} [location]  
 * @apiParam {Boolean} [isStockListing]  
 * 
 * 
 */

/**
 * @api {post} /api/companies Create instance
 * @apiName CompanyCreateInstance
 * @apiGroup Company
 * @apiParam {String} name  
 * 
 * @apiParam {String} [president]  person id
 * @apiParam {String} [location]  
 * @apiParam {Boolean} [isStockListing]  
 * 
 * 
 */

/**
 * @api {post} /api/companies Validate parameters
 * @apiName CompanyValidateParameters
 * @apiGroup Company
 * @apiParam {String} [name]  
 * 
 * @apiParam {String} [president]  person id
 * @apiParam {String} [location]  
 * @apiParam {Boolean} [isStockListing]  
 * 
 * @apiHeader {String} X-Validation When the header has <code>true</code>, validate parameters
 */

/**
 * @api {delete} /api/companies Delete collection
 * @apiName CompanyDeleteCollection
 * @apiGroup Company
 * @apiParam {String} [name]  
 * 
 * @apiParam {String} [president]  person id
 * @apiParam {String} [location]  
 * @apiParam {Boolean} [isStockListing]  
 * 
 * 
 */

/**
 * @api {get} /api/people/:id Get instance
 * @apiName PersonGetInstance
 * @apiGroup Person
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiSuccess {String} id 
 * @apiSuccess {String} name 
 * @apiSuccess {String} company 
 * @apiSuccess {Number} age 
 * @apiSuccess {String} createdAt 
 * @apiSuccess {String} updatedAt 
 * 
 */

/**
 * @api {get} /api/people Get collection
 * @apiName PersonGetCollection
 * @apiGroup Person
 * @apiParam {String} [name]  
 * @apiParam {String} [company]  
 * @apiParam {Number} [age]  
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiParam {String} [expands] Expand specified `parent`, `instance` fields.
 * `children` field could not expanded.
 * @apiParam {String} [orderBy] Specify sort order of fetched collection.
 * For example `orderBy=+name,-age`
 * @apiSuccess {Number} offset
 * @apiSuccess {Number} limit
 * @apiSuccess {Number} size
 * @apiSuccess {String} first
 * @apiSuccess {String} last
 * @apiSuccess {String} prev
 * @apiSuccess {String} next
 * @apiSuccess {Object[]} items Array of Person instance
 * 
 */

/**
 * @api {get} /api/people Get JSON Schema
 * @apiName PersonGetJSONSchema
 * @apiGroup Person
 * 
 * 
 * @apiHeader {String} X-JSON-Schema When the header has <code>true</code>, response JSON Schema instead
 */

/**
 * @api {post} /api/people Create instance
 * @apiName PersonCreateInstance
 * @apiGroup Person
 * @apiParam {String} name  
 * @apiParam {String} [company]  
 * @apiParam {Number} [age]  
 * 
 * 
 */

/**
 * @api {post} /api/people Validate parameters
 * @apiName PersonValidateParameters
 * @apiGroup Person
 * @apiParam {String} [name]  
 * @apiParam {String} [company]  
 * @apiParam {Number} [age]  
 * 
 * @apiHeader {String} X-Validation When the header has <code>true</code>, validate parameters
 */

/**
 * @api {delete} /api/people Delete collection
 * @apiName PersonDeleteCollection
 * @apiGroup Person
 * @apiParam {String} [name]  
 * @apiParam {String} [company]  
 * @apiParam {Number} [age]  
 * 
 * 
 */

/**
 * @api {get} /api/holidays/:id Get instance
 * @apiName HolidayGetInstance
 * @apiGroup Holiday
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiSuccess {String} id 
 * @apiSuccess {String} name 
 * @apiSuccess {String} start 
 * @apiSuccess {String} end 
 * @apiSuccess {String} createdAt 
 * @apiSuccess {String} updatedAt 
 * 
 */

/**
 * @api {get} /api/holidays Get collection
 * @apiName HolidayGetCollection
 * @apiGroup Holiday
 * @apiParam {String} [name]  
 * @apiParam {String} [start]  
 * @apiParam {String} [end]  
 * @apiParam {String} [fields] Pertial attribution will be responsed.
 * Attributions should be separated with comma.
 * @apiParam {String} [expands] Expand specified `parent`, `instance` fields.
 * `children` field could not expanded.
 * @apiParam {String} [orderBy] Specify sort order of fetched collection.
 * For example `orderBy=+name,-age`
 * @apiSuccess {Number} offset
 * @apiSuccess {Number} limit
 * @apiSuccess {Number} size
 * @apiSuccess {String} first
 * @apiSuccess {String} last
 * @apiSuccess {String} prev
 * @apiSuccess {String} next
 * @apiSuccess {Object[]} items Array of Holiday instance
 * 
 */

/**
 * @api {get} /api/holidays Get JSON Schema
 * @apiName HolidayGetJSONSchema
 * @apiGroup Holiday
 * 
 * 
 * @apiHeader {String} X-JSON-Schema When the header has <code>true</code>, response JSON Schema instead
 */

/**
 * @api {post} /api/holidays Create instance
 * @apiName HolidayCreateInstance
 * @apiGroup Holiday
 * @apiParam {String} name  
 * @apiParam {String} [start]  
 * @apiParam {String} [end]  
 * 
 * 
 */

/**
 * @api {post} /api/holidays Validate parameters
 * @apiName HolidayValidateParameters
 * @apiGroup Holiday
 * @apiParam {String} [name]  
 * @apiParam {String} [start]  
 * @apiParam {String} [end]  
 * 
 * @apiHeader {String} X-Validation When the header has <code>true</code>, validate parameters
 */

/**
 * @api {delete} /api/holidays Delete collection
 * @apiName HolidayDeleteCollection
 * @apiGroup Holiday
 * @apiParam {String} [name]  
 * @apiParam {String} [start]  
 * @apiParam {String} [end]  
 * 
 * 
 */