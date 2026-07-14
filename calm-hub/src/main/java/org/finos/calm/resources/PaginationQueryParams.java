package org.finos.calm.resources;

import jakarta.validation.constraints.Min;
import jakarta.ws.rs.QueryParam;
import org.finos.calm.store.PageRequest;

import static org.finos.calm.resources.ResourceValidationConstants.LIMIT_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.OFFSET_MESSAGE;

/**
 * Shared {@code @BeanParam} bean for the optional {@code limit}/{@code offset} paging query
 * parameters on the namespace summary endpoints. Centralises the validation annotations so the
 * architecture and pattern resources don't duplicate them.
 */
public class PaginationQueryParams {

    @QueryParam("limit")
    @Min(value = 1, message = LIMIT_MESSAGE)
    Integer limit;

    @QueryParam("offset")
    @Min(value = 0, message = OFFSET_MESSAGE)
    Integer offset;

    public PaginationQueryParams() {
    }

    /**
     * @return a {@link PageRequest} value object for the store layer.
     */
    public PageRequest toPageRequest() {
        return new PageRequest(limit, offset);
    }
}
