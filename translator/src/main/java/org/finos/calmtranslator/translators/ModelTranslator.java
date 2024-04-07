package org.finos.calmtranslator.translators;

import org.finos.calmtranslator.calm.Core;

/**
 * An interface to translate from CALM Model to the defined type
 * @param <T> The output of type of the translated CALM model
 */
public interface ModelTranslator<T> {

	/**
	 *
	 * Convert the CALM Model to the Model Type
	 *
	 * @param calmModel CALM model to translate
	 * @return the translated type
	 */
	T translate(Core calmModel);
}
