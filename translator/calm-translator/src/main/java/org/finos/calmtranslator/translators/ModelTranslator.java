package org.finos.calmtranslator.translators;

import org.finos.calmtranslator.calm.Core;

/**
 * An interface to translate from CALM Model
 * @param <T>
 */
public interface ModelTranslator<T> {

	/**
	 *
	 * Convert the CALM Model to the Model Type
	 *
	 * @param calmModel
	 * @return
	 */
	T translate(Core calmModel);
}
